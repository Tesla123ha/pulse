import { supabase } from '../lib/supabase';
import { estimateKcal } from '../lib/activity';
import { dateKey, fromDateKey, middayOf } from '../lib/dates';
import type { ProfileRow, SetLogRow } from '../lib/database.types';
import { storedLoad } from '../lib/load';
import { loadWorkouts, type WorkoutWithExercises } from './workouts';
import { maybe, must } from './useLoader';

export interface PastWorkoutData {
  workouts: WorkoutWithExercises[];
  /** Workout ids in plan order, listed first. */
  planWorkoutIds: string[];
  units: ProfileRow['units'];
  /** Sets logged before the chosen day, newest first: the "last time" for prefills. */
  history: SetLogRow[];
}

export async function loadPastWorkout(userId: string, day: string): Promise<PastWorkoutData> {
  const [library, profile] = await Promise.all([
    loadWorkouts(),
    supabase.from('profiles').select('units').eq('id', userId).single().then(must),
  ]);
  const ids = library.workouts.flatMap((w) => w.exercises.map((e) => e.id));
  const history = ids.length
    ? must(
        await supabase
          .from('set_logs')
          .select('*')
          .in('exercise_id', ids)
          .lt('logged_at', fromDateKey(day).toISOString())
          .order('logged_at', { ascending: false })
          .limit(1000),
      )
    : [];
  return {
    workouts: library.workouts.filter((w) => w.exercises.length > 0),
    planWorkoutIds: library.planWorkoutIds,
    units: profile.units,
    history,
  };
}

export interface PastSet {
  exerciseId: string;
  setNumber: number;
  /** kg, or stack level for machine exercises */
  load: number;
  /** reps, or seconds for timed holds */
  reps: number;
}

/**
 * Saves a finished workout to a past day: the session, its sets, a lift
 * activity, and any new personal best compared with sets before that day.
 * Backdated workouts do not tick plan slots.
 */
export async function savePastWorkout(input: {
  userId: string;
  workout: WorkoutWithExercises;
  day: string;
  durationMin: number;
  sets: PastSet[];
}): Promise<void> {
  const { userId, workout, day, durationMin, sets } = input;
  if (sets.length === 0) throw new Error('Tick at least one set to save this workout.');

  const started = middayOf(day);
  const ended = new Date(started.getTime() + durationMin * 60_000);
  const byId = new Map(workout.exercises.map((e) => [e.id, e]));
  const allDone = workout.exercises.every(
    (e) => sets.filter((s) => s.exerciseId === e.id).length >= e.target_sets,
  );

  const session = must(
    await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        workout_id: workout.id,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        status: allDone ? 'completed' : 'ended_early',
      })
      .select('id')
      .single(),
  );

  try {
    // Space the sets through the workout so their order reads back correctly.
    const spacing = (durationMin * 60_000) / Math.max(1, sets.length);
    must(
      await supabase
        .from('set_logs')
        .insert(
          sets.map((s, i) => {
            const stack = byId.get(s.exerciseId)?.load_unit === 'stack';
            const load = Math.round(s.load * 100) / 100;
            return {
              session_id: session.id,
              exercise_id: s.exerciseId,
              set_number: s.setNumber,
              weight_kg: stack ? 0 : load,
              stack_level: stack ? load : null,
              reps: s.reps,
              logged_at: new Date(started.getTime() + i * spacing).toISOString(),
            };
          }),
        )
        .select('id'),
    );

    maybe(
      await supabase.from('activity_logs').insert({
        user_id: userId,
        type: 'lift',
        duration_min: durationMin,
        kcal: estimateKcal('lift', durationMin),
        logged_at: started.toISOString(),
        session_id: session.id,
      }),
    );
  } catch (e) {
    // Leave nothing half-saved.
    await supabase.from('workout_sessions').delete().eq('id', session.id);
    throw e;
  }

  // Personal records: heavier than any set before that day.
  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const prior = must(
    await supabase
      .from('set_logs')
      .select('exercise_id, weight_kg, stack_level')
      .in('exercise_id', exerciseIds)
      .lt('logged_at', started.toISOString())
      .limit(5000),
  );
  const records = exerciseIds.flatMap((id) => {
    const ex = byId.get(id);
    if (!ex) return [];
    const best = Math.max(...sets.filter((s) => s.exerciseId === id).map((s) => s.load));
    const previous = prior.filter((p) => p.exercise_id === id).map((p) => storedLoad(p, ex));
    const previousBest = previous.length ? Math.max(...previous) : 0;
    return previousBest > 0 && best > previousBest
      ? [{ user_id: userId, name: ex.name, value: best, unit: ex.load_unit, achieved_on: dateKey(started) }]
      : [];
  });
  if (records.length) maybe(await supabase.from('personal_records').insert(records));
}
