import { supabase } from '../lib/supabase';
import { estimateKcal } from '../lib/activity';
import { dateKey } from '../lib/dates';
import type { ProfileRow, SetLogRow, WorkoutExerciseRow, WorkoutRow, WorkoutSessionRow } from '../lib/database.types';
import { buildModel, elapsedSeconds } from '../lib/session';
import { maybe, must } from './useLoader';

export interface SessionData {
  session: WorkoutSessionRow;
  workout: WorkoutRow;
  exercises: WorkoutExerciseRow[];
  /** Sets logged in this session. */
  sets: SetLogRow[];
  /** Recent sets for these exercises from earlier sessions, newest first. */
  history: SetLogRow[];
  units: ProfileRow['units'];
}

const OPEN = ['in_progress', 'paused'] as const;

async function loadSession(session: WorkoutSessionRow, userId: string): Promise<SessionData> {
  const [workout, exercises, sets, profile] = await Promise.all([
    supabase.from('workouts').select('*').eq('id', session.workout_id).single().then(must),
    supabase.from('workout_exercises').select('*').eq('workout_id', session.workout_id).order('position').then(must),
    supabase.from('set_logs').select('*').eq('session_id', session.id).then(must),
    supabase.from('profiles').select('units').eq('id', userId).single().then(must),
  ]);
  const history = exercises.length
    ? must(
        await supabase
          .from('set_logs')
          .select('*')
          .in(
            'exercise_id',
            exercises.map((e) => e.id),
          )
          .neq('session_id', session.id)
          .order('logged_at', { ascending: false })
          .limit(200),
      )
    : [];
  return { session, workout, exercises, sets, history, units: profile.units };
}

/** The open session, or null when there is none. */
export async function loadOpenSession(userId: string): Promise<SessionData | null> {
  const open = maybe(await supabase.from('workout_sessions').select('*').in('status', OPEN).maybeSingle());
  return open ? loadSession(open, userId) : null;
}

/**
 * Returns the open session, starting one for `workoutId` when none is open.
 * A database constraint allows one open session per user, so this never duplicates.
 */
export async function loadOrStartSession(
  userId: string,
  start: { workoutId: string; planWorkoutId: string | null } | null,
): Promise<SessionData | null> {
  const existing = await loadOpenSession(userId);
  if (existing || !start) return existing;
  const created = must(
    await supabase
      .from('workout_sessions')
      .insert({ user_id: userId, workout_id: start.workoutId, plan_workout_id: start.planWorkoutId })
      .select('*')
      .single(),
  );
  return loadSession(created, userId);
}

export async function logSet(input: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
}): Promise<SetLogRow> {
  return must(
    await supabase
      .from('set_logs')
      .insert({
        session_id: input.sessionId,
        exercise_id: input.exerciseId,
        set_number: input.setNumber,
        weight_kg: Math.round(input.weightKg * 100) / 100,
        reps: input.reps,
      })
      .select('*')
      .single(),
  );
}

async function updateSession(id: string, patch: Partial<WorkoutSessionRow>): Promise<WorkoutSessionRow> {
  return must(await supabase.from('workout_sessions').update(patch).eq('id', id).select('*').single());
}

export function pauseSession(s: WorkoutSessionRow) {
  return updateSession(s.id, { status: 'paused', paused_at: new Date().toISOString() });
}

export function resumeSession(s: WorkoutSessionRow) {
  const pausedFor = s.paused_at ? Math.round((Date.now() - new Date(s.paused_at).getTime()) / 1000) : 0;
  return updateSession(s.id, {
    status: 'in_progress',
    paused_at: null,
    paused_seconds: s.paused_seconds + Math.max(0, pausedFor),
  });
}

/** Moves `current` after `next`, so the next exercise is done first. */
export function swapWithNext(s: WorkoutSessionRow, order: string[], currentId: string, nextId: string) {
  const ids = order.filter((id) => id !== currentId);
  ids.splice(ids.indexOf(nextId) + 1, 0, currentId);
  return updateSession(s.id, { exercise_order: ids });
}

export function skipExercise(s: WorkoutSessionRow, exerciseId: string) {
  return updateSession(s.id, { skipped_exercise_ids: [...new Set([...s.skipped_exercise_ids, exerciseId])] });
}

export function saveNotes(s: WorkoutSessionRow, notes: string) {
  return updateSession(s.id, { notes: notes.trim() || null });
}

/**
 * Ends the session. With no sets logged the empty session is removed.
 * Otherwise it is saved as completed (every exercise done) or ended early,
 * logged as a lift activity, ticks off its plan slot when completed, and
 * records new personal bests in weight.
 */
export async function endSession(data: SessionData, userId: string): Promise<void> {
  const { session, exercises, sets } = data;
  if (sets.length === 0) {
    maybe(await supabase.from('workout_sessions').delete().eq('id', session.id));
    return;
  }

  const now = new Date();
  const model = buildModel(session, exercises, sets);
  const seconds = elapsedSeconds(session, now);
  const pausedExtra = session.paused_at ? Math.round((now.getTime() - new Date(session.paused_at).getTime()) / 1000) : 0;
  const status = model.allDone ? 'completed' : 'ended_early';

  await updateSession(session.id, {
    status,
    ended_at: now.toISOString(),
    paused_at: null,
    paused_seconds: session.paused_seconds + Math.max(0, pausedExtra),
  });

  const minutes = Math.max(1, Math.round(seconds / 60));
  maybe(
    await supabase.from('activity_logs').insert({
      user_id: userId,
      type: 'lift',
      duration_min: minutes,
      kcal: estimateKcal('lift', minutes),
      logged_at: now.toISOString(),
      session_id: session.id,
    }),
  );

  if (status === 'completed' && session.plan_workout_id) {
    maybe(
      await supabase
        .from('plan_workouts')
        .update({ completed_session_id: session.id, completed_at: now.toISOString() })
        .eq('id', session.plan_workout_id),
    );
  }

  // Personal records: a heavier set than any earlier session for that exercise.
  const ids = [...new Set(sets.map((s) => s.exercise_id))];
  const prior = must(
    await supabase
      .from('set_logs')
      .select('exercise_id, weight_kg')
      .in('exercise_id', ids)
      .neq('session_id', session.id)
      .order('weight_kg', { ascending: false })
      .limit(5000),
  );
  const records = ids.flatMap((id) => {
    const best = Math.max(...sets.filter((s) => s.exercise_id === id).map((s) => Number(s.weight_kg)));
    const previous = prior.filter((p) => p.exercise_id === id).map((p) => Number(p.weight_kg));
    const previousBest = previous.length ? Math.max(...previous) : 0;
    const ex = exercises.find((e) => e.id === id);
    return ex && previousBest > 0 && best > previousBest
      ? [{ user_id: userId, name: ex.name, value: best, unit: 'kg' as const, achieved_on: dateKey(now) }]
      : [];
  });
  if (records.length) maybe(await supabase.from('personal_records').insert(records));
}
