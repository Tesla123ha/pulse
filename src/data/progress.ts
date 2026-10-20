import { supabase } from '../lib/supabase';
import type { ActivityLogRow, PersonalRecordRow, ProfileRow } from '../lib/database.types';
import { must } from './useLoader';

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
  const [profile, activity, sessions, records] = await Promise.all([
    supabase.from('profiles').select('units, active_goal_min').eq('id', userId).single().then(must),
    supabase
      .from('activity_logs')
      .select('*, session:workout_sessions(workout:workouts(name))')
      .order('logged_at', { ascending: false })
      .limit(10000)
      .then(must),
    supabase
      .from('workout_sessions')
      .select('ended_at')
      .in('status', ['completed', 'ended_early'])
      .not('ended_at', 'is', null)
      .then(must),
    supabase.from('personal_records').select('*').then(must),
  ]);
  return {
    profile,
    activity: activity.map(({ session, ...a }) => ({ ...a, workoutName: session?.workout?.name ?? null })),
    sessionsEndedAt: sessions.map((s) => s.ended_at).filter((t): t is string => Boolean(t)),
    records,
  };
}

/**
 * Deletes one logged activity. For a gym workout this also deletes its
 * session and logged sets, and un-ticks the plan slot it completed.
 */
export async function deleteActivity(a: Pick<ProgressActivity, 'id' | 'session_id'>): Promise<void> {
  if (a.session_id) {
    must(
      await supabase
        .from('plan_workouts')
        .update({ completed_session_id: null, completed_at: null })
        .eq('completed_session_id', a.session_id)
        .select('id'),
    );
  }
  must(await supabase.from('activity_logs').delete().eq('id', a.id).select('id'));
  if (a.session_id) {
    // Set logs go with the session (on delete cascade).
    must(await supabase.from('workout_sessions').delete().eq('id', a.session_id).select('id'));
  }
}
