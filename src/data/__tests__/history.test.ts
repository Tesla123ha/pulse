import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: () => Promise.resolve({ connected: true }), addListener: () => Promise.resolve({ remove() {} }) },
}));

import { closeUserDb, deleteUserDb, getDb, openUserDb } from '../../offline/db';
import { loadHome } from '../home';
import { loadHistory, loadSessionDetail } from '../history';
import { loadProgress } from '../progress';
import { endSession, loadOrStartSession, logSet } from '../session';
import { displayToStored } from '../../lib/load';

const U = 'hist-user';
const ex = (id: string, name: string, over = {}) =>
  ({ id, workout_id: 'w1', position: 1, name, muscles: [], target_sets: 3, rep_min: 5, rep_max: 8, rest_seconds: 60, load_unit: 'kg', target_type: 'reps', start_load: null, ...over }) as never;

beforeEach(async () => {
  closeUserDb();
  await deleteUserDb(U);
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const db = await openUserDb(U);
  await db.profiles.put({ id: U, units: 'metric', active_goal_min: 30, workouts_per_week: 4, move_goal_kcal: 600 } as never);
  await db.workouts.put({ id: 'w1', owner: null, name: 'Push', category: 'Strength', duration_min: 30, level: 'x', equipment: '', created_at: 'a' } as never);
  await db.workout_exercises.bulkPut([ex('e1', 'Bench Press'), ex('e2', 'Incline Press', { load_unit: 'stack', position: 2 })]);
});

/** Starts, logs and finishes one workout through the real data layer. */
async function doWorkout(kg: number, pl: number) {
  const d = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: null }))!;
  const a = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(kg, 'kg'), reps: 5 });
  const b = await logSet({ sessionId: d.session.id, exerciseId: 'e2', setNumber: 1, stored: displayToStored(pl, 'pl'), reps: 10 });
  await endSession({ ...d, sets: [a, b] }, U);
  return d.session.id;
}

describe('history, home and trends from the local store', () => {
  it('lists finished workouts, writes their sets out, and ignores an empty history', async () => {
    expect((await loadHistory(U)).entries).toEqual([]);
    const id = await doWorkout(60, 12);
    const history = await loadHistory(U);
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({ sessionId: id, workoutName: 'Push', setCount: 2, volumeKg: 300 });
    expect(history.openSession).toBeNull();
    const detail = await loadSessionDetail(id, 'metric');
    expect(detail.exercises.map((e) => [e.name, e.sets[0].text])).toEqual([
      ['Bench Press', '60 kg x 5'],
      ['Incline Press', '12 PL x 10'],
    ]);
  });

  it('reports an open workout so repeating one does not silently resume it', async () => {
    await doWorkout(60, 12);
    await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: null });
    expect((await loadHistory(U)).openSession).toEqual({ workoutName: 'Push' });
  });

  it('counts this week and finds the last workout on Home', async () => {
    expect((await loadHome(U)).workoutsThisWeek).toBe(0);
    expect((await loadHome(U)).lastWorkout).toBeNull();
    await doWorkout(60, 12);
    const home = await loadHome(U);
    expect(home.workoutsThisWeek).toBe(1);
    expect(home.lastWorkout?.workoutName).toBe('Push');
  });

  it('builds a lift trend from real sets, one point per workout', async () => {
    await doWorkout(60, 12);
    // a second workout on a later day
    const db = getDb();
    const first = (await db.workout_sessions.toArray())[0];
    await db.workout_sessions.update(first.id, { ended_at: '2026-01-01T10:00:00Z', started_at: '2026-01-01T09:00:00Z' });
    await doWorkout(65, 13);
    const { trends } = await loadProgress(U);
    const bench = trends.find((t) => t.name === 'Bench Press')!;
    expect(bench.points.map((p) => p.value)).toEqual([60, 65]);
    expect(trends.find((t) => t.name === 'Incline Press')!.choice).toBe('pl');
  });
});
