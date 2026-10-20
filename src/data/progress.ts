import type { ActivityLogRow, PersonalRecordRow, ProfileRow } from '../lib/database.types';
import { getDb } from '../offline/db';
import { inflightSeqs, localWrite } from '../offline/outbox';
import { byTimeDesc } from './sort';

export type ProgressActivity = ActivityLogRow & { workoutName: string | null };

export interface ProgressData {
  profile: Pick<ProfileRow, 'units' | 'active_goal_min'>;
  /** All activity, newest first. */
  activity: ProgressActivity[];
  /** Finish times of saved workout sessions. */
  sessionsEndedAt: string[];
  records: PersonalRecordRow[];
}

export async function loadProgress(userId: string): Promise<ProgressData> {
  const db = getDb();
  const [profile, activity, sessions, records, workouts] = await Promise.all([
    db.profiles.get(userId),
    db.activity_logs.toArray(),
    db.workout_sessions.toArray(),
    db.personal_records.toArray(),
    db.workouts.toArray(),
  ]);
  if (!profile) throw new Error('Your profile is not available yet.');
  const workoutOf = new Map(sessions.map((s) => [s.id, s.workout_id]));
  const nameOf = new Map(workouts.map((w) => [w.id, w.name]));
  return {
    profile: { units: profile.units, active_goal_min: profile.active_goal_min },
    activity: activity.sort(byTimeDesc).map((a) => ({
      ...a,
      workoutName: (a.session_id && nameOf.get(workoutOf.get(a.session_id) ?? '')) || null,
    })),
    sessionsEndedAt: sessions
      .filter((s) => (s.status === 'completed' || s.status === 'ended_early') && s.ended_at)
      .map((s) => s.ended_at as string),
    records,
  };
}

/**
 * Deletes one logged activity. For a gym workout this also deletes its
 * session and logged sets, and un-ticks the plan slot it completed.
 */
export async function deleteActivity(a: Pick<ProgressActivity, 'id' | 'session_id'>): Promise<void> {
  const db = getDb();
  await localWrite(db, ['plan_workouts', 'activity_logs', 'workout_sessions', 'set_logs'], async (w) => {
    if (a.session_id) {
      await w.updateWhere('plan_workouts', { completed_session_id: a.session_id }, { completed_session_id: null, completed_at: null });
    }
    await w.remove('activity_logs', a.id);
    if (a.session_id) {
      // The server deletes the sets with the session (on delete cascade); mirror that here without queuing
      // deletes. Writes for those sets that never reached the server are dropped so they cannot be pushed.
      const setIds = (await db.set_logs.where('session_id').equals(a.session_id).primaryKeys()) as string[];
      await db.set_logs.bulkDelete(setIds);
      const ids = new Set(setIds);
      const orphans = await db.outbox
        .where('table')
        .equals('set_logs')
        .filter((o) => ids.has(o.rowKey) && o.status === 'pending' && !inflightSeqs.has(o.seq as number))
        .primaryKeys();
      await db.outbox.bulkDelete(orphans);
      await w.remove('workout_sessions', a.session_id);
    }
  });
}
