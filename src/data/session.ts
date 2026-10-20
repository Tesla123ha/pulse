import { estimateKcal } from '../lib/activity';
import { dateKey } from '../lib/dates';
import type { ProfileRow, SetLogRow, WorkoutExerciseRow, WorkoutRow, WorkoutSessionRow } from '../lib/database.types';
import { storedLoad } from '../lib/load';
import { buildModel, elapsedSeconds } from '../lib/session';
import { getDb } from '../offline/db';
import { localWrite } from '../offline/outbox';
import { newActivityRow, newPersonalRecordRow, newSessionRow, newSetLogRow } from '../offline/rows';
import { byTimeDesc } from './sort';

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
  const db = getDb();
  const [workout, exercises, sets, profile] = await Promise.all([
    db.workouts.get(session.workout_id),
    db.workout_exercises.where('workout_id').equals(session.workout_id).toArray(),
    db.set_logs.where('session_id').equals(session.id).toArray(),
    db.profiles.get(userId),
  ]);
  if (!workout) throw new Error('This workout is not available on this device yet.');
  if (!profile) throw new Error('Your profile is not available yet.');
  exercises.sort((a, b) => a.position - b.position);
  const ids = exercises.map((e) => e.id);
  const history = ids.length
    ? (await db.set_logs.where('exercise_id').anyOf(ids).filter((s) => s.session_id !== session.id).toArray())
        .sort(byTimeDesc)
        .slice(0, 200)
    : [];
  return { session, workout, exercises, sets, history, units: profile.units };
}

const findOpen = () => getDb().workout_sessions.where('status').anyOf(...OPEN).first();

/** The open session, or null when there is none. */
export async function loadOpenSession(userId: string): Promise<SessionData | null> {
  const open = await findOpen();
  return open ? loadSession(open, userId) : null;
}

/**
 * Returns the open session, starting one for `workoutId` when none is open.
 * Only one session may be open at a time, so this never duplicates.
 */
export async function loadOrStartSession(
  userId: string,
  start: { workoutId: string; planWorkoutId: string | null } | null,
): Promise<SessionData | null> {
  const existing = await loadOpenSession(userId);
  if (existing || !start) return existing;
  const db = getDb();
  let created: WorkoutSessionRow | null = null;
  await localWrite(db, ['workout_sessions'], async (w) => {
    // Checked again inside the transaction so two quick starts cannot both create one.
    if (await findOpen()) return;
    created = newSessionRow({ user_id: userId, workout_id: start.workoutId, plan_workout_id: start.planWorkoutId });
    await w.upsert('workout_sessions', created);
  });
  const open = created ?? (await findOpen());
  return open ? loadSession(open, userId) : null;
}

export async function logSet(input: {
  sessionId: string;
  exercise: Pick<WorkoutExerciseRow, 'id' | 'load_unit'>;
  setNumber: number;
  /** kg, or stack level for machine exercises */
  load: number;
  reps: number;
}): Promise<SetLogRow> {
  const db = getDb();
  const stack = input.exercise.load_unit === 'stack';
  const load = Math.round(input.load * 100) / 100;
  const row = newSetLogRow({
    session_id: input.sessionId,
    exercise_id: input.exercise.id,
    set_number: input.setNumber,
    weight_kg: stack ? 0 : load,
    stack_level: stack ? load : null,
    reps: input.reps,
  });
  await localWrite(db, ['set_logs'], async (w) => {
    // Mirrors the database's unique (session, exercise, set number).
    const clash = await db.set_logs
      .where('session_id')
      .equals(row.session_id)
      .filter((s) => s.exercise_id === row.exercise_id && s.set_number === row.set_number)
      .first();
    if (clash) throw new Error('That set is already logged.');
    await w.upsert('set_logs', row);
  });
  return row;
}

async function updateSession(id: string, patch: Partial<WorkoutSessionRow>): Promise<WorkoutSessionRow> {
  const db = getDb();
  await localWrite(db, ['workout_sessions'], (w) => w.update('workout_sessions', id, patch));
  const row = await db.workout_sessions.get(id);
  if (!row) throw new Error('This workout session no longer exists.');
  return row;
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
  const db = getDb();
  if (sets.length === 0) {
    await localWrite(db, ['workout_sessions'], (w) => w.remove('workout_sessions', session.id));
    return;
  }

  const now = new Date();
  const model = buildModel(session, exercises, sets);
  const seconds = elapsedSeconds(session, now);
  const pausedExtra = session.paused_at ? Math.round((now.getTime() - new Date(session.paused_at).getTime()) / 1000) : 0;
  const status = model.allDone ? 'completed' : 'ended_early';
  const minutes = Math.max(1, Math.round(seconds / 60));

  await localWrite(db, ['workout_sessions', 'activity_logs', 'plan_workouts', 'personal_records', 'set_logs'], async (w) => {
    await w.update('workout_sessions', session.id, {
      status,
      ended_at: now.toISOString(),
      paused_at: null,
      paused_seconds: session.paused_seconds + Math.max(0, pausedExtra),
    });

    await w.upsert(
      'activity_logs',
      newActivityRow({
        user_id: userId,
        type: 'lift',
        duration_min: minutes,
        kcal: estimateKcal('lift', minutes),
        logged_at: now.toISOString(),
        session_id: session.id,
      }),
    );

    if (status === 'completed' && session.plan_workout_id) {
      await w.update('plan_workouts', session.plan_workout_id, {
        completed_session_id: session.id,
        completed_at: now.toISOString(),
      });
    }

    // Personal records: a heavier load than any earlier session for that exercise.
    const ids = [...new Set(sets.map((s) => s.exercise_id))];
    const prior = await db.set_logs.where('exercise_id').anyOf(ids).filter((s) => s.session_id !== session.id).toArray();
    for (const id of ids) {
      const ex = exercises.find((e) => e.id === id);
      if (!ex) continue;
      const best = Math.max(...sets.filter((s) => s.exercise_id === id).map((s) => storedLoad(s, ex)));
      const previous = prior.filter((p) => p.exercise_id === id).map((p) => storedLoad(p, ex));
      const previousBest = previous.length ? Math.max(...previous) : 0;
      if (previousBest > 0 && best > previousBest) {
        await w.upsert(
          'personal_records',
          newPersonalRecordRow({ user_id: userId, name: ex.name, value: best, unit: ex.load_unit, achieved_on: dateKey(now) }),
        );
      }
    }
  });
}
