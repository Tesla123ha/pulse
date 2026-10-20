import { supabase } from '../lib/supabase';
import type { AchievementRow, ProfileRow } from '../lib/database.types';
import { longestStreak } from '../lib/progress';
import { maybe, must } from './useLoader';

export interface Achievement extends AchievementRow {
  earnedAt: string | null;
}

export interface ProfileData {
  profile: ProfileRow;
  email: string;
  achievements: Achievement[];
}

/** Which catalogue achievements the user's history has earned. */
async function earnedCodes(): Promise<Set<string>> {
  const [activity, runs, sessions] = await Promise.all([
    supabase.from('activity_logs').select('logged_at').limit(10000).then(must),
    supabase.from('activity_logs').select('id').eq('type', 'run').gte('distance_km', 5).limit(1).then(must),
    supabase
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed'),
  ]);
  if (sessions.error) throw new Error(sessions.error.message);
  const codes = new Set<string>();
  if (longestStreak(activity) >= 7) codes.add('streak_7');
  if (runs.length > 0) codes.add('first_5k');
  if ((sessions.count ?? 0) >= 100) codes.add('workouts_100');
  return codes;
}

/** Loads the profile and achievements, recording any achievement newly earned. */
export async function loadProfile(userId: string, email: string): Promise<ProfileData> {
  const [profile, catalogue, mine, earned] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single().then(must),
    supabase.from('achievements').select('*').order('sort_order').then(must),
    supabase.from('user_achievements').select('achievement_id, earned_at').then(must),
    earnedCodes(),
  ]);

  const have = new Map(mine.map((m) => [m.achievement_id, m.earned_at]));
  const fresh = catalogue.filter((a) => earned.has(a.code) && !have.has(a.id));
  if (fresh.length) {
    const now = new Date().toISOString();
    maybe(
      await supabase
        .from('user_achievements')
        .insert(fresh.map((a) => ({ user_id: userId, achievement_id: a.id, earned_at: now }))),
    );
    for (const a of fresh) have.set(a.id, now);
  }

  return {
    profile,
    email,
    achievements: catalogue.map((a) => ({ ...a, earnedAt: have.get(a.id) ?? null })),
  };
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    'display_name' | 'workouts_per_week' | 'move_goal_kcal' | 'active_goal_min' | 'main_focus' | 'units' | 'reminders_enabled'
  >
>;

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileRow> {
  return must(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single());
}

/** Everything stored for this account, as one JSON document. */
export async function exportMyData(): Promise<string> {
  const tables = [
    'profiles',
    'workouts',
    'user_plans',
    'plan_workouts',
    'workout_sessions',
    'set_logs',
    'activity_logs',
    'personal_records',
    'user_achievements',
    'money_accounts',
    'money_records',
    'money_categories',
  ] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  for (const t of tables) {
    // Row level security returns only this account's rows (and built-in workouts).
    out[t] = must(await supabase.from(t).select('*').limit(50000));
  }
  return JSON.stringify(out, null, 2);
}
