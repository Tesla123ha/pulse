import { addDays, dateKey, lastDays, startOfDay, weekdayLetter, weekdayName } from '../lib/dates';
import type { ActivityLogRow, ActivityType, MatchType, ProfileRow, SwimVenue, WorkoutRow } from '../lib/database.types';
import type { WeekDay } from '../components';
import { getDb } from '../offline/db';
import { localWrite } from '../offline/outbox';
import { newActivityRow } from '../offline/rows';
import { buildHistory, latestWorkout, workoutsInLastDays, type HistoryEntry } from '../lib/history';
import { byTimeDesc } from './sort';

export interface HomeWorkout {
  workoutId: string;
  name: string;
  durationMin: number;
  level: string;
  exerciseCount: number;
  /** Plan slot this workout fills, if it comes from the active plan. */
  planWorkoutId: string | null;
  /** Set when a session for it is already open. */
  openSessionId: string | null;
}

export interface HomeData {
  profile: ProfileRow;
  week: WeekDay[];
  activeDays: number;
  streak: number;
  burnedKcal: number;
  activeMin: number;
  workout: HomeWorkout | null;
  lastByType: Partial<Record<ActivityType, ActivityLogRow>>;
  /** Workouts finished in the last 7 days, against the profile's weekly target. */
  workoutsThisWeek: number;
  /** The most recent finished workout with sets, if any. */
  lastWorkout: HistoryEntry | null;
}

const toHomeWorkout = (
  w: WorkoutRow,
  exerciseCount: number,
  planWorkoutId: string | null,
  openSessionId: string | null,
): HomeWorkout => ({
  workoutId: w.id,
  name: w.name,
  durationMin: w.duration_min,
  level: w.level,
  exerciseCount,
  planWorkoutId,
  openSessionId,
});

/** Consecutive active days ending today, or ending yesterday if today has no activity yet. */
function streakFrom(activeKeys: Set<string>, today: Date): number {
  let day = activeKeys.has(dateKey(today)) ? startOfDay(today) : addDays(today, -1);
  let n = 0;
  while (activeKeys.has(dateKey(day))) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

async function loadTodaysWorkout(): Promise<HomeWorkout | null> {
  const db = getDb();
  const withCount = async (w: WorkoutRow, planWorkoutId: string | null, openSessionId: string | null) =>
    toHomeWorkout(w, await db.workout_exercises.where('workout_id').equals(w.id).count(), planWorkoutId, openSessionId);

  // 1. A session already in progress wins.
  const open = await db.workout_sessions.where('status').anyOf('in_progress', 'paused').first();
  const openWorkout = open ? await db.workouts.get(open.workout_id) : undefined;
  if (open && openWorkout) return withCount(openWorkout, open.plan_workout_id, open.id);

  // 2. Otherwise the next unfinished workout of the active plan.
  const plan = await db.user_plans.filter((p) => p.is_active).first();
  if (plan) {
    const slots = (await db.plan_workouts.where('plan_id').equals(plan.id).toArray())
      .filter((s) => !s.completed_at)
      .sort((a, b) => a.position - b.position);
    for (const slot of slots) {
      const w = await db.workouts.get(slot.workout_id);
      if (w) return withCount(w, slot.id, null);
    }
  }

  // 3. No plan or plan finished: the first built-in workout.
  const builtIn = (await db.workouts.filter((w) => w.owner === null).toArray()).sort(
    (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )[0];
  return builtIn ? withCount(builtIn, null, null) : null;
}

export async function loadHome(userId: string): Promise<HomeData> {
  const now = new Date();
  const today = dateKey(now);
  // A year of activity covers the streak; only the needed columns are read.
  const since = addDays(startOfDay(now), -365).toISOString();

  const db = getDb();
  const sinceMs = new Date(since).getTime();
  const [profile, allActivity, workout, sessions] = await Promise.all([
    db.profiles.get(userId),
    db.activity_logs.toArray(),
    loadTodaysWorkout(),
    db.workout_sessions.where('status').anyOf('completed', 'ended_early').toArray(),
  ]);
  if (!profile) throw new Error('Your profile is not available yet.');
  const activity = allActivity.filter((a) => new Date(a.logged_at).getTime() >= sinceMs).sort(byTimeDesc);

  const activeKeys = new Set(activity.map((a) => dateKey(new Date(a.logged_at))));
  const days = lastDays(7, now);
  const week: WeekDay[] = days.map((d) => {
    const key = dateKey(d);
    const active = activeKeys.has(key);
    const isToday = key === today;
    return {
      letter: weekdayLetter(d),
      name: weekdayName(d),
      status: isToday ? (active ? 'today-done' : 'today') : active ? 'done' : 'missed',
    };
  });

  const todays = activity.filter((a) => dateKey(new Date(a.logged_at)) === today);
  const lastByType: HomeData['lastByType'] = {};
  for (const a of activity) lastByType[a.type] ??= a;

  // Only the newest finished sessions are needed to find the last workout
  const newest = sessions
    .filter((s) => s.ended_at)
    .sort((a, b) => new Date(b.ended_at as string).getTime() - new Date(a.ended_at as string).getTime())
    .slice(0, 5);
  const newestSets = await db.set_logs.where('session_id').anyOf(newest.map((s) => s.id)).toArray();
  const workouts = await db.workouts.bulkGet([...new Set(newest.map((s) => s.workout_id))]);

  return {
    workoutsThisWeek: workoutsInLastDays(sessions, now),
    lastWorkout: latestWorkout(
      buildHistory(newest, newestSets, workouts.filter((w): w is NonNullable<typeof w> => Boolean(w))),
    ),
    profile,
    week,
    activeDays: days.filter((d) => activeKeys.has(dateKey(d))).length,
    streak: streakFrom(activeKeys, now),
    burnedKcal: todays.reduce((s, a) => s + a.kcal, 0),
    activeMin: todays.reduce((s, a) => s + a.duration_min, 0),
    workout,
    lastByType,
  };
}

export interface NewActivity {
  type: ActivityType;
  durationMin: number;
  kcal: number;
  distanceKm?: number;
  paceSecPerKm?: number;
  venue?: SwimVenue;
  matchType?: MatchType;
  wins?: number;
  losses?: number;
  /** When it happened; defaults to now. Set for entries added to a past day. */
  loggedAt?: string;
}

export async function logActivity(userId: string, a: NewActivity) {
  const row = newActivityRow({
    user_id: userId,
    type: a.type,
    duration_min: a.durationMin,
    kcal: a.kcal,
    distance_km: a.distanceKm ?? null,
    pace_sec_per_km: a.paceSecPerKm ?? null,
    venue: a.venue ?? null,
    match_type: a.matchType ?? null,
    wins: a.wins ?? null,
    losses: a.losses ?? null,
    ...(a.loggedAt ? { logged_at: a.loggedAt } : {}),
  });
  await localWrite(getDb(), ['activity_logs'], (w) => w.upsert('activity_logs', row));
}
