import { estimateKcal } from '../lib/activity';
import { dateKey, fromDateKey, middayOf } from '../lib/dates';
import type { ProfileRow, SetLogRow } from '../lib/database.types';
import type { LoadChoice, StoredLoad } from '../lib/load';
import { loadWorkouts, type WorkoutWithExercises } from './workouts';
import { getDb } from '../offline/db';
import { localWrite } from '../offline/outbox';
import { newActivityRow, newPersonalRecordRow, newSessionRow, newSetLogRow } from '../offline/rows';
import { newBests } from './bests';
import { loadLoadPrefs } from './loadPrefs';
import { byTimeDesc } from './sort';

export interface PastWorkoutData {
  workouts: WorkoutWithExercises[];
  /** Workout ids in plan order, listed first. */
  planWorkoutIds: string[];
  units: ProfileRow['units'];
  /** Sets logged before the chosen day, newest first: the "last time" for prefills. */
  history: SetLogRow[];
  /** The weight unit chosen for each exercise, by exercise id. */
  prefs: Record<string, LoadChoice>;
}

export async function loadPastWorkout(userId: string, day: string): Promise<PastWorkoutData> {
  const db = getDb();
  const [library, profile, prefs] = await Promise.all([loadWorkouts(), db.profiles.get(userId), loadLoadPrefs()]);
  if (!profile) throw new Error('Your profile is not available yet.');
  const ids = library.workouts.flatMap((w) => w.exercises.map((e) => e.id));
  const before = fromDateKey(day).getTime();
  const history = ids.length
    ? (await db.set_logs.where('exercise_id').anyOf(ids).filter((s) => new Date(s.logged_at).getTime() < before).toArray())
        .sort(byTimeDesc)
        .slice(0, 1000)
    : [];
  return {
    workouts: library.workouts.filter((w) => w.exercises.length > 0),
    planWorkoutIds: library.planWorkoutIds,
    units: profile.units,
    history,
    prefs,
  };
}

export interface PastSet {
  exerciseId: string;
  setNumber: number;
  /** What to store, from displayToStored: kg, or a stack level (PL) */
  stored: StoredLoad;
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

  const session = newSessionRow({
    user_id: userId,
    workout_id: workout.id,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    status: allDone ? 'completed' : 'ended_early',
  });
  // Space the sets through the workout so their order reads back correctly.
  const spacing = (durationMin * 60_000) / Math.max(1, sets.length);
  const setRows = sets.map((s, i) => {
    return newSetLogRow({
      session_id: session.id,
      exercise_id: s.exerciseId,
      set_number: s.setNumber,
      weight_kg: s.stored.weight_kg,
      stack_level: s.stored.stack_level,
      reps: s.reps,
      logged_at: new Date(started.getTime() + i * spacing).toISOString(),
    });
  });
  const activity = newActivityRow({
    user_id: userId,
    type: 'lift',
    duration_min: durationMin,
    kcal: estimateKcal('lift', durationMin),
    logged_at: started.toISOString(),
    session_id: session.id,
  });

  // One transaction: either everything is saved and queued, or nothing is.
  const db = getDb();
  await localWrite(db, ['workout_sessions', 'set_logs', 'activity_logs', 'personal_records'], async (w) => {
    // Personal records: heavier than any set before that day, per kind of set (PL or kg).
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
    const prior = await db.set_logs
      .where('exercise_id')
      .anyOf(exerciseIds)
      .filter((p) => new Date(p.logged_at).getTime() < started.getTime())
      .toArray();

    await w.upsert('workout_sessions', session);
    for (const row of setRows) await w.upsert('set_logs', row);
    await w.upsert('activity_logs', activity);

    for (const id of exerciseIds) {
      const ex = byId.get(id);
      if (!ex) continue;
      const bests = newBests(
        sets.filter((s) => s.exerciseId === id).map((s) => s.stored),
        prior.filter((p) => p.exercise_id === id),
      );
      for (const b of bests) {
        await w.upsert(
          'personal_records',
          newPersonalRecordRow({ user_id: userId, name: ex.name, value: b.value, unit: b.unit, achieved_on: dateKey(started) }),
        );
      }
    }
  });
}
