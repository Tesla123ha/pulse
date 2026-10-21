import { addDays, startOfDay } from './dates';
import type { SetLogRow, Units, WorkoutExerciseRow, WorkoutRow, WorkoutSessionRow } from './database.types';
import { formatSetLoad, setKind, storedToDisplay, unitsChoice, type LoadChoice, type SetKind } from './load';

/** One finished workout in the history list. */
export interface HistoryEntry {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  endedAt: string;
  /** Minutes of work, excluding time spent paused. */
  durationMin: number;
  setCount: number;
  exerciseCount: number;
  /** Total weight lifted (weight x reps) over sets logged in kg. Machine (PL) sets are not counted. */
  volumeKg: number;
  status: 'completed' | 'ended_early';
}

const finished = (s: WorkoutSessionRow): s is WorkoutSessionRow & { status: 'completed' | 'ended_early'; ended_at: string } =>
  (s.status === 'completed' || s.status === 'ended_early') && Boolean(s.ended_at);

/** Minutes between start and end, minus paused time. Never negative. */
export function sessionMinutes(s: Pick<WorkoutSessionRow, 'started_at' | 'ended_at' | 'paused_seconds'>): number {
  if (!s.ended_at) return 0;
  const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() - (s.paused_seconds ?? 0) * 1000;
  return Math.max(0, Math.round(ms / 60000));
}

/** Finished workouts that have at least one set, newest first. */
export function buildHistory(
  sessions: WorkoutSessionRow[],
  sets: Pick<SetLogRow, 'session_id' | 'exercise_id' | 'weight_kg' | 'reps' | 'stack_level'>[],
  workouts: Pick<WorkoutRow, 'id' | 'name'>[],
): HistoryEntry[] {
  const names = new Map(workouts.map((w) => [w.id, w.name]));
  const bySession = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = bySession.get(s.session_id);
    if (list) list.push(s);
    else bySession.set(s.session_id, [s]);
  }
  return sessions
    .filter(finished)
    .map((s): HistoryEntry | null => {
      const mine = bySession.get(s.id) ?? [];
      if (mine.length === 0) return null;
      return {
        sessionId: s.id,
        workoutId: s.workout_id,
        workoutName: names.get(s.workout_id) ?? 'Workout',
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationMin: sessionMinutes(s),
        setCount: mine.length,
        exerciseCount: new Set(mine.map((m) => m.exercise_id)).size,
        volumeKg: mine.reduce((sum, m) => (setKind(m) === 'mass' ? sum + Number(m.weight_kg) * m.reps : sum), 0),
        status: s.status,
      };
    })
    .filter((e): e is HistoryEntry => e !== null)
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
}

/** Case-insensitive match on the workout name. */
export const filterHistory = (entries: HistoryEntry[], query: string): HistoryEntry[] => {
  const q = query.trim().toLowerCase();
  return q ? entries.filter((e) => e.workoutName.toLowerCase().includes(q)) : entries;
};

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

/** Groups already-sorted entries under month headings, keeping their order. */
export function groupByMonth(entries: HistoryEntry[]): { month: string; entries: HistoryEntry[] }[] {
  const groups: { month: string; entries: HistoryEntry[] }[] = [];
  for (const e of entries) {
    const month = MONTH.format(new Date(e.endedAt));
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(e);
    else groups.push({ month, entries: [e] });
  }
  return groups;
}

/** One exercise of a finished workout, with its sets written out. */
export interface DetailExercise {
  name: string;
  sets: { number: number; text: string }[];
}

/** The sets of one workout grouped by exercise, in the order the exercises were done. */
export function buildDetail(
  sets: SetLogRow[],
  exercises: Pick<WorkoutExerciseRow, 'id' | 'name' | 'position'>[],
  units: Units,
  prefs: Record<string, LoadChoice> = {},
): DetailExercise[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Map<string, SetLogRow[]>();
  for (const s of sets) {
    const list = groups.get(s.exercise_id);
    if (list) list.push(s);
    else groups.set(s.exercise_id, [s]);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({ ex: byId.get(id), id, list }))
    .sort((a, b) => (a.ex?.position ?? 999) - (b.ex?.position ?? 999))
    .map(({ ex, id, list }) => ({
      name: ex?.name ?? 'Exercise',
      sets: list
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          number: s.set_number,
          text: `${formatSetLoad(s, prefs[id] ?? units)} x ${s.reps}`,
        })),
    }));
}

/** Workouts finished in the last 7 days counting today, the same window as the week strip on Home. */
export function workoutsInLastDays(sessions: WorkoutSessionRow[], now: Date, days = 7): number {
  const from = startOfDay(addDays(now, -(days - 1))).getTime();
  const to = addDays(startOfDay(now), 1).getTime();
  return sessions.filter((s) => {
    if (!finished(s) || s.status !== 'completed') return false;
    const t = new Date(s.ended_at).getTime();
    return t >= from && t < to;
  }).length;
}

/** The most recent finished workout, if any. */
export const latestWorkout = (entries: HistoryEntry[]): HistoryEntry | null => entries[0] ?? null;

/** "Today", "Yesterday", "3 days ago", then the date, relative to `now` by calendar day. */
export function relativeDay(iso: string, now: Date): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** One point of an exercise trend: the best set of one workout. */
export interface TrendPoint {
  sessionId: string;
  date: string;
  /** Load in the unit the series is drawn in (kg or lb, or machine level). */
  value: number;
  reps: number;
}

export interface ExerciseTrend {
  name: string;
  kind: SetKind;
  /** The unit the values are in. */
  choice: LoadChoice;
  points: TrendPoint[];
  lastLoggedAt: string;
}

/**
 * Best set per workout for each exercise, matched by name so the same lift in different workouts
 * shares one history. Heaviest load wins, then more reps. An exercise logged both in kg and on a
 * machine is drawn in whichever it was last logged in; the other kind is not mixed in. Exercises with
 * no load (planks) are left out. Newest exercises first, with at most `limit` exercises and
 * `maxPoints` workouts each.
 */
export function buildTrends(
  sessions: WorkoutSessionRow[],
  sets: SetLogRow[],
  exercises: Pick<WorkoutExerciseRow, 'id' | 'name'>[],
  units: Units,
  prefs: Record<string, LoadChoice> = {},
  limit = 8,
  maxPoints = 12,
): ExerciseTrend[] {
  const done = new Map(sessions.filter(finished).map((s) => [s.id, s]));
  const nameOf = new Map(exercises.map((e) => [e.id, e.name.trim()]));
  const byName = new Map<string, { name: string; sets: SetLogRow[] }>();
  for (const s of sets) {
    const name = nameOf.get(s.exercise_id);
    if (!name || !done.has(s.session_id)) continue;
    const key = name.toLowerCase();
    const group = byName.get(key);
    if (group) group.sets.push(s);
    else byName.set(key, { name, sets: [s] });
  }

  const trends: ExerciseTrend[] = [];
  for (const { name, sets: list } of byName.values()) {
    const timeOf = (s: SetLogRow) => new Date(done.get(s.session_id)!.ended_at as string).getTime();
    const newest = list.reduce((a, b) => (timeOf(b) > timeOf(a) ? b : a));
    const kind = setKind(newest);
    const exId = newest.exercise_id;
    const choice: LoadChoice = kind === 'pl' ? 'pl' : prefs[exId] === 'lb' ? 'lb' : prefs[exId] === 'kg' ? 'kg' : unitsChoice(units);

    const best = new Map<string, SetLogRow>();
    for (const s of list) {
      if (setKind(s) !== kind) continue;
      const load = kind === 'pl' ? Number(s.stack_level) : Number(s.weight_kg);
      const current = best.get(s.session_id);
      const currentLoad = current ? (kind === 'pl' ? Number(current.stack_level) : Number(current.weight_kg)) : -1;
      if (!current || load > currentLoad || (load === currentLoad && s.reps > current.reps)) best.set(s.session_id, s);
    }
    const points = [...best.values()]
      .map((s) => {
        const sess = done.get(s.session_id)!;
        return { sessionId: s.session_id, date: sess.ended_at as string, value: round1(storedToDisplay(s, choice)), reps: s.reps };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-maxPoints);
    if (points.length === 0 || points.every((p) => p.value <= 0)) continue;
    trends.push({ name, kind, choice, points, lastLoggedAt: points[points.length - 1].date });
  }
  return trends.sort((a, b) => new Date(b.lastLoggedAt).getTime() - new Date(a.lastLoggedAt).getTime()).slice(0, limit);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Change between the first and last point, or null when there are fewer than two. */
export function trendChange(points: TrendPoint[]): { delta: number; first: number; last: number } | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  return { delta: round1(last - first), first, last };
}
