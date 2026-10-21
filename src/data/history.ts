import type { Units } from '../lib/database.types';
import { buildDetail, buildHistory, type DetailExercise, type HistoryEntry } from '../lib/history';
import { getDb } from '../offline/db';
import { loadLoadPrefs } from './loadPrefs';

/** Finished workouts shown in the list; older ones stay stored and are still counted in Progress. */
export const HISTORY_LIMIT = 300;

export interface HistoryData {
  units: Units;
  /** Newest first. */
  entries: HistoryEntry[];
  /** A workout already in progress. Repeating a workout would silently resume it, so the screen says so. */
  openSession: { workoutName: string } | null;
}

export async function loadHistory(userId: string): Promise<HistoryData> {
  const db = getDb();
  const [profile, sessions, workouts] = await Promise.all([
    db.profiles.get(userId),
    db.workout_sessions.where('status').anyOf('completed', 'ended_early').toArray(),
    db.workouts.toArray(),
  ]);
  if (!profile) throw new Error('Your profile is not available yet.');
  // Newest sessions first, so only their sets are read
  const recent = sessions
    .filter((s) => s.ended_at)
    .sort((a, b) => new Date(b.ended_at as string).getTime() - new Date(a.ended_at as string).getTime())
    .slice(0, HISTORY_LIMIT);
  const sets = await db.set_logs.where('session_id').anyOf(recent.map((s) => s.id)).toArray();
  const open = await db.workout_sessions.where('status').anyOf('in_progress', 'paused').first();
  const openName = open ? workouts.find((w) => w.id === open.workout_id)?.name : undefined;
  return {
    units: profile.units,
    entries: buildHistory(recent, sets, workouts),
    openSession: open ? { workoutName: openName ?? 'Workout' } : null,
  };
}

export interface SessionDetail {
  exercises: DetailExercise[];
  notes: string | null;
}

/** The sets of one finished workout, written out by exercise. */
export async function loadSessionDetail(sessionId: string, units: Units): Promise<SessionDetail> {
  const db = getDb();
  const [session, sets, prefs] = await Promise.all([
    db.workout_sessions.get(sessionId),
    db.set_logs.where('session_id').equals(sessionId).toArray(),
    loadLoadPrefs(),
  ]);
  const exercises = await db.workout_exercises.bulkGet([...new Set(sets.map((s) => s.exercise_id))]);
  return {
    notes: session?.notes ?? null,
    exercises: buildDetail(
      sets,
      exercises.filter((e): e is NonNullable<typeof e> => Boolean(e)),
      units,
      prefs,
    ),
  };
}
