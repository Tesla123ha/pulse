import { supabase } from '../lib/supabase';
import { addDays, dateKey, lastDays, startOfDay, weekdayLetter, weekdayName } from '../lib/dates';
import type { ActivityLogRow, ActivityType, MatchType, ProfileRow, SwimVenue } from '../lib/database.types';
import type { WeekDay } from '../components';
import { maybe, must } from './useLoader';

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
}

type WorkoutWithCount = {
  id: string;
  name: string;
  duration_min: number;
  level: string;
  workout_exercises: { count: number }[];
};

const toHomeWorkout = (
  w: WorkoutWithCount,
  planWorkoutId: string | null,
  openSessionId: string | null,
): HomeWorkout => ({
  workoutId: w.id,
  name: w.name,
  durationMin: w.duration_min,
  level: w.level,
  exerciseCount: w.workout_exercises[0]?.count ?? 0,
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
  // 1. A session already in progress wins.
  const open = maybe(
    await supabase
      .from('workout_sessions')
      .select('id, plan_workout_id, workout:workouts(id, name, duration_min, level, workout_exercises(count))')
      .in('status', ['in_progress', 'paused'])
      .maybeSingle(),
  );
  if (open?.workout) {
    return toHomeWorkout(open.workout, open.plan_workout_id, open.id);
  }

  // 2. Otherwise the next unfinished workout of the active plan.
  const plan = maybe(
    await supabase
      .from('user_plans')
      .select('id, plan_workouts(id, position, completed_at, workout:workouts(id, name, duration_min, level, workout_exercises(count)))')
      .eq('is_active', true)
      .maybeSingle(),
  );
  const slots = (plan?.plan_workouts ?? [])
    .filter((s) => !s.completed_at && s.workout)
    .sort((a, b) => a.position - b.position);
  if (slots[0]?.workout) return toHomeWorkout(slots[0].workout, slots[0].id, null);

  // 3. No plan or plan finished: the first built-in workout.
  const builtIn = maybe(
    await supabase
      .from('workouts')
      .select('id, name, duration_min, level, workout_exercises(count)')
      .is('owner', null)
      .order('created_at')
      .order('name')
      .limit(1)
      .maybeSingle(),
  );
  return builtIn ? toHomeWorkout(builtIn, null, null) : null;
}

export async function loadHome(userId: string): Promise<HomeData> {
  const now = new Date();
  const today = dateKey(now);
  // A year of activity covers the streak; only the needed columns are read.
  const since = addDays(startOfDay(now), -365).toISOString();

  const [profile, activity, workout] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single().then(must),
    supabase
      .from('activity_logs')
      .select('*')
      .gte('logged_at', since)
      .order('logged_at', { ascending: false })
      .limit(5000)
      .then(must),
    loadTodaysWorkout(),
  ]);

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

  return {
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
  maybe(
    await supabase.from('activity_logs').insert({
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
    }),
  );
}
