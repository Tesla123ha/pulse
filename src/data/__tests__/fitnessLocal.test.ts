import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: () => Promise.resolve({ connected: true }), addListener: () => Promise.resolve({ remove() {} }) },
}));

import { closeUserDb, deleteUserDb, openUserDb } from '../../offline/db';
import { deleteActivity, loadProgress } from '../progress';
import { endSession, loadOrStartSession, logSet } from '../session';
import { savePastWorkout } from '../pastWorkout';
import { loadLoadPrefs, setLoadPref } from '../loadPrefs';
import { displayToStored } from '../../lib/load';

const U = 'u1';
const ex = {
  id: 'e1', workout_id: 'w1', position: 1, name: 'Bench', muscles: [], target_sets: 1, rep_min: 5, rep_max: 8,
  rest_seconds: 60, load_unit: 'kg', target_type: 'reps', start_load: null,
} as never;

beforeEach(async () => {
  closeUserDb();
  // Dexie keeps the IndexedDB it saw at import, so wipe the named database rather than swapping the factory.
  await deleteUserDb(U);
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const db = await openUserDb(U);
  await db.profiles.put({ id: U, units: 'metric', active_goal_min: 30 } as never);
  await db.workouts.put({ id: 'w1', owner: null, name: 'Push', category: 'Strength', duration_min: 30, level: 'x', equipment: '', created_at: 'a' } as never);
  await db.workout_exercises.put(ex);
  await db.user_plans.put({ id: 'p1', is_active: true } as never);
  await db.plan_workouts.put({ id: 'pw1', plan_id: 'p1', workout_id: 'w1', position: 1, week_number: 1, completed_session_id: null, completed_at: null } as never);
  await db.set_logs.put({ id: 'old', session_id: 'oldS', exercise_id: 'e1', set_number: 1, weight_kg: 50, reps: 5, stack_level: null, logged_at: '2020-01-01T00:00:00+00:00' } as never);
});

describe('fitness data on the local store', () => {
  it('runs a session end to end and deletes it again', async () => {
    const d = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: 'pw1' }))!;
    const again = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: 'pw1' }))!;
    expect(again.session.id).toBe(d.session.id);
    const set = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(60, 'kg'), reps: 5 });
    await expect(logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(60, 'kg'), reps: 5 })).rejects.toThrow();
    await endSession({ ...d, sets: [set] }, U);
    const { getDb } = await import('../../offline/db');
    const db = getDb();
    expect((await db.workout_sessions.get(d.session.id))?.status).toBe('completed');
    expect((await db.plan_workouts.get('pw1'))?.completed_session_id).toBe(d.session.id);
    expect((await db.personal_records.toArray()).map((r) => r.value)).toEqual([60]);
    const prog = await loadProgress(U);
    expect(prog.activity[0].workoutName).toBe('Push');
    await deleteActivity(prog.activity[0]);
    expect(await db.activity_logs.count()).toBe(0);
    expect(await db.workout_sessions.count()).toBe(0);
    expect((await db.plan_workouts.get('pw1'))?.completed_session_id).toBeNull();
    expect(await db.set_logs.where('session_id').equals(d.session.id).count()).toBe(0);
  });

  it('saves a past workout atomically', async () => {
    const { getDb } = await import('../../offline/db');
    await savePastWorkout({
      userId: U, workout: { id: 'w1', exercises: [ex] } as never, day: '2026-01-05', durationMin: 30,
      sets: [{ exerciseId: 'e1', setNumber: 1, stored: displayToStored(70, 'kg'), reps: 5 }],
    });
    const db = getDb();
    expect(await db.workout_sessions.count()).toBe(1);
    expect(await db.set_logs.count()).toBe(2);
    expect((await db.personal_records.toArray())[0].value).toBe(70);
  });

  it('stores a PL set on a kg exercise as a stack level, and an lb set as kg', async () => {
    const { getDb } = await import('../../offline/db');
    const d = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: null }))!;
    const pl = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(12, 'pl'), reps: 8 });
    const lb = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 2, stored: displayToStored(100, 'lb'), reps: 8 });
    expect(await getDb().set_logs.get(pl.id)).toMatchObject({ weight_kg: 0, stack_level: 12 });
    expect(await getDb().set_logs.get(lb.id)).toMatchObject({ weight_kg: 45.36, stack_level: null });
  });

  it('records personal bests per kind with no record across kinds', async () => {
    const { getDb } = await import('../../offline/db');
    const db = getDb();
    await db.set_logs.put({ id: 'oldpl', session_id: 'oldS', exercise_id: 'e1', set_number: 2, weight_kg: 0, reps: 5, stack_level: 10, logged_at: '2020-01-02T00:00:00+00:00' } as never);
    const d = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: null }))!;
    const a = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(12, 'pl'), reps: 5 });
    const b = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 2, stored: displayToStored(40, 'kg'), reps: 5 });
    await endSession({ ...d, sets: [a, b] }, U);
    // PL 12 beats 10; 40 kg does not beat 50 kg. A heavy PL never counts against kg.
    expect((await db.personal_records.toArray()).map((r) => [r.unit, r.value])).toEqual([['stack', 12]]);
  });

  it('sets no record for the first set of a new kind', async () => {
    const { getDb } = await import('../../offline/db');
    const d = (await loadOrStartSession(U, { workoutId: 'w1', planWorkoutId: null }))!;
    const a = await logSet({ sessionId: d.session.id, exerciseId: 'e1', setNumber: 1, stored: displayToStored(200, 'pl'), reps: 5 });
    await endSession({ ...d, sets: [a] }, U);
    expect(await getDb().personal_records.count()).toBe(0);
  });

  it('saves a past workout with mixed kinds', async () => {
    const { getDb } = await import('../../offline/db');
    const db = getDb();
    await savePastWorkout({
      userId: U, workout: { id: 'w1', exercises: [ex] } as never, day: '2026-01-05', durationMin: 30,
      sets: [
        { exerciseId: 'e1', setNumber: 1, stored: displayToStored(60, 'kg'), reps: 5 },
        { exerciseId: 'e1', setNumber: 2, stored: displayToStored(8, 'pl'), reps: 5 },
      ],
    });
    const rows = await db.set_logs.where('session_id').notEqual('oldS').toArray();
    expect(rows.map((r) => [r.set_number, r.weight_kg, r.stack_level]).sort()).toEqual([[1, 60, null], [2, 0, 8]]);
    // 60 kg beats the earlier 50 kg; the PL set is the first of its kind, so no record.
    expect((await db.personal_records.toArray()).map((r) => [r.unit, r.value])).toEqual([['kg', 60]]);
  });

  it('remembers a unit locally and queues exactly one outbox op', async () => {
    const { getDb } = await import('../../offline/db');
    const db = getDb();
    await setLoadPref('e1', 'pl');
    await setLoadPref('e1', 'lb');
    expect(await loadLoadPrefs()).toEqual({ e1: 'lb' });
    const ops = (await db.outbox.toArray()).filter((o) => o.table === 'exercise_load_prefs');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'upsert', rowKey: `${U}:e1`, row: { unit: 'lb', user_id: U } });
  });
});
