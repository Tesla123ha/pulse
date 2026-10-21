import { describe, expect, it } from 'vitest';
import type { SetLogRow, WorkoutSessionRow } from '../database.types';
import {
  buildDetail,
  buildHistory,
  buildTrends,
  filterHistory,
  groupByMonth,
  relativeDay,
  sessionMinutes,
  trendChange,
  workoutsInLastDays,
} from '../history';

const session = (id: string, endedAt: string | null, over: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow => ({
  id,
  user_id: 'u',
  workout_id: 'w1',
  plan_workout_id: null,
  started_at: endedAt ? new Date(new Date(endedAt).getTime() - 45 * 60000).toISOString() : '2026-10-01T10:00:00Z',
  ended_at: endedAt,
  status: endedAt ? 'completed' : 'in_progress',
  paused_at: null,
  paused_seconds: 0,
  exercise_order: null,
  skipped_exercise_ids: [],
  notes: null,
  ...over,
});

let n = 0;
const set = (sessionId: string, exerciseId: string, over: Partial<SetLogRow> = {}): SetLogRow => ({
  id: `s${n++}`,
  session_id: sessionId,
  exercise_id: exerciseId,
  set_number: 1,
  weight_kg: 50,
  reps: 8,
  stack_level: null,
  logged_at: '2026-10-01T10:00:00Z',
  ...over,
});

const workouts = [{ id: 'w1', name: 'Push' }, { id: 'w2', name: 'Pull' }];

describe('sessionMinutes', () => {
  it('subtracts paused time and never goes negative', () => {
    expect(sessionMinutes({ started_at: '2026-10-01T10:00:00Z', ended_at: '2026-10-01T11:00:00Z', paused_seconds: 600 })).toBe(50);
    expect(sessionMinutes({ started_at: '2026-10-01T10:00:00Z', ended_at: '2026-10-01T10:05:00Z', paused_seconds: 9999 })).toBe(0);
    expect(sessionMinutes({ started_at: '2026-10-01T10:00:00Z', ended_at: null, paused_seconds: 0 })).toBe(0);
  });
});

describe('buildHistory', () => {
  const sessions = [
    session('a', '2026-10-10T12:00:00Z'),
    session('b', '2026-10-12T12:00:00Z', { workout_id: 'w2' }),
    session('open', null),
    session('empty', '2026-10-11T12:00:00Z'),
    session('early', '2026-10-09T12:00:00Z', { status: 'ended_early' }),
  ];
  const sets = [
    set('a', 'e1'),
    set('a', 'e1', { set_number: 2, reps: 10 }),
    set('a', 'e2', { weight_kg: 0, stack_level: 12 }),
    set('b', 'e3'),
    set('early', 'e1'),
    set('open', 'e1'),
  ];
  const history = buildHistory(sessions, sets, workouts);

  it('lists finished workouts with sets, newest first', () => {
    expect(history.map((h) => h.sessionId)).toEqual(['b', 'a', 'early']);
  });
  it('leaves out open workouts and workouts with no sets', () => {
    expect(history.find((h) => h.sessionId === 'open')).toBeUndefined();
    expect(history.find((h) => h.sessionId === 'empty')).toBeUndefined();
  });
  it('counts sets, exercises and weight lifted, ignoring machine sets', () => {
    const a = history.find((h) => h.sessionId === 'a')!;
    expect(a.setCount).toBe(3);
    expect(a.exerciseCount).toBe(2);
    expect(a.volumeKg).toBe(50 * 8 + 50 * 10);
    expect(a.durationMin).toBe(45);
    expect(a.workoutName).toBe('Push');
  });
  it('filters by name and groups by month', () => {
    expect(filterHistory(history, ' PUSH ').map((h) => h.workoutName)).toEqual(['Push', 'Push']);
    expect(filterHistory(history, '')).toHaveLength(3);
    const groups = groupByMonth(history);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(3);
    const two = groupByMonth([...history, ...buildHistory([session('z', '2026-09-30T12:00:00Z')], [set('z', 'e1')], workouts)]);
    expect(two.map((g) => g.month)).toEqual(['October 2026', 'September 2026']);
  });
});

describe('buildDetail', () => {
  const exercises = [{ id: 'e1', name: 'Bench', position: 2 }, { id: 'e2', name: 'Row', position: 1 }];
  it('orders exercises and sets and writes loads in the right unit', () => {
    const detail = buildDetail(
      [set('a', 'e1', { set_number: 2, weight_kg: 60 }), set('a', 'e1', { set_number: 1 }), set('a', 'e2', { weight_kg: 0, stack_level: 9, reps: 12 })],
      exercises,
      'metric',
    );
    expect(detail.map((d) => d.name)).toEqual(['Row', 'Bench']);
    expect(detail[0].sets[0].text).toBe('9 PL x 12');
    expect(detail[1].sets.map((s) => s.number)).toEqual([1, 2]);
    expect(detail[1].sets[1].text).toBe('60 kg x 8');
  });
  it('shows pounds for imperial accounts', () => {
    const [d] = buildDetail([set('a', 'e1', { weight_kg: 45.36 })], exercises, 'imperial');
    expect(d.sets[0].text).toBe('100 lb x 8');
  });
});

describe('workoutsInLastDays', () => {
  const now = new Date('2026-10-20T15:00:00');
  it('counts finished workouts in the window, including today, ended early ones, and excluding older ones', () => {
    const s = [
      session('1', '2026-10-20T08:00:00'),
      session('2', '2026-10-14T09:00:00'),
      session('3', '2026-10-13T23:59:00'),
      session('4', '2026-10-18T09:00:00', { status: 'ended_early' }),
      session('5', null),
    ];
    expect(workoutsInLastDays(s, now)).toBe(3);
  });
});

describe('relativeDay', () => {
  const now = new Date('2026-10-20T15:00:00');
  it('reads naturally by calendar day', () => {
    expect(relativeDay('2026-10-20T01:00:00', now)).toBe('Today');
    expect(relativeDay('2026-10-19T23:00:00', now)).toBe('Yesterday');
    expect(relativeDay('2026-10-17T10:00:00', now)).toBe('3 days ago');
    expect(relativeDay('2026-09-02T10:00:00', now)).toBe('Sep 2');
  });
});

describe('buildTrends', () => {
  const sessions = [
    session('s1', '2026-10-01T12:00:00Z'),
    session('s2', '2026-10-08T12:00:00Z', { workout_id: 'w2' }),
    session('s3', '2026-10-15T12:00:00Z'),
    session('open', null),
  ];
  // "Bench" is a different exercise row in each workout but the same lift
  const exercises = [
    { id: 'b1', name: 'Bench Press' },
    { id: 'b2', name: 'bench press ' },
    { id: 'p1', name: 'Plank' },
    { id: 'm1', name: 'Lat Pulldown' },
  ];
  const sets = [
    set('s1', 'b1', { weight_kg: 50, reps: 8 }),
    set('s1', 'b1', { weight_kg: 55, reps: 5, set_number: 2 }),
    set('s2', 'b2', { weight_kg: 57.5, reps: 5 }),
    set('s3', 'b1', { weight_kg: 60, reps: 4 }),
    set('s3', 'b1', { weight_kg: 60, reps: 6, set_number: 2 }),
    set('open', 'b1', { weight_kg: 200, reps: 1 }),
    set('s1', 'p1', { weight_kg: 0, reps: 60 }),
    set('s1', 'm1', { weight_kg: 0, stack_level: 8, reps: 10 }),
    set('s3', 'm1', { weight_kg: 0, stack_level: 9, reps: 10 }),
  ];

  const trends = buildTrends(sessions, sets, exercises, 'metric');

  it('groups the same lift by name across workouts and takes the best set of each workout', () => {
    const bench = trends.find((t) => t.name.toLowerCase().startsWith('bench'))!;
    expect(bench.points.map((p) => p.value)).toEqual([55, 57.5, 60]);
    expect(bench.points[2].reps).toBe(6);
    expect(bench.choice).toBe('kg');
  });
  it('ignores workouts that are not finished', () => {
    const bench = trends.find((t) => t.name.toLowerCase().startsWith('bench'))!;
    expect(Math.max(...bench.points.map((p) => p.value))).toBeLessThan(200);
  });
  it('leaves out exercises with no load', () => {
    expect(trends.find((t) => t.name === 'Plank')).toBeUndefined();
  });
  it('draws machine exercises in machine levels', () => {
    const lat = trends.find((t) => t.name === 'Lat Pulldown')!;
    expect(lat.kind).toBe('pl');
    expect(lat.choice).toBe('pl');
    expect(lat.points.map((p) => p.value)).toEqual([8, 9]);
  });
  it('converts to pounds for imperial accounts', () => {
    const bench = buildTrends(sessions, sets, exercises, 'imperial').find((t) => t.name.toLowerCase().startsWith('bench'))!;
    expect(bench.choice).toBe('lb');
    expect(bench.points[0].value).toBe(121.3);
  });
  it('keeps only the newest points and exercises', () => {
    const many = Array.from({ length: 20 }, (_, i) => session(`m${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00Z`));
    const manySets = many.map((s, i) => set(s.id, 'b1', { weight_kg: 40 + i }));
    const t = buildTrends(many, manySets, exercises, 'metric', {}, 8, 12)[0];
    expect(t.points).toHaveLength(12);
    expect(t.points[11].value).toBe(59);
  });
  it('orders exercises by how recently they were logged', () => {
    expect(trends).toHaveLength(2);
    expect(trends[0].lastLoggedAt >= trends[1].lastLoggedAt).toBe(true);
  });
});

describe('trendChange', () => {
  it('needs two points', () => {
    expect(trendChange([{ sessionId: 'a', date: 'x', value: 50, reps: 5 }])).toBeNull();
    expect(
      trendChange([
        { sessionId: 'a', date: 'x', value: 50, reps: 5 },
        { sessionId: 'b', date: 'y', value: 57.5, reps: 5 },
      ]),
    ).toEqual({ delta: 7.5, first: 50, last: 57.5 });
  });
});
