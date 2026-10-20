import { supabase } from '../lib/supabase';
import type { AchievementRow, ProfileRow } from '../lib/database.types';
import { longestStreak } from '../lib/progress';
import { getDb } from '../offline/db';
import { isOnline } from '../offline/network';
import { localWrite } from '../offline/outbox';
import { must } from './useLoader';

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
  const db = getDb();
  const [activity, sessions] = await Promise.all([
    db.activity_logs.toArray(),
    db.workout_sessions.where('status').equals('completed').count(),
  ]);
  const codes = new Set<string>();
  if (longestStreak(activity) >= 7) codes.add('streak_7');
  if (activity.some((a) => a.type === 'run' && a.distance_km !== null && Number(a.distance_km) >= 5)) codes.add('first_5k');
  if (sessions >= 100) codes.add('workouts_100');
  return codes;
}

/** Loads the profile and achievements, recording any achievement newly earned. */
export async function loadProfile(userId: string, email: string): Promise<ProfileData> {
  const db = getDb();
  const [profile, catalogue, mine, earned] = await Promise.all([
    db.profiles.get(userId),
    db.achievements.toArray(),
    db.user_achievements.toArray(),
    earnedCodes(),
  ]);
  if (!profile) throw new Error('Your profile is not available yet.');
  catalogue.sort((a, b) => a.sort_order - b.sort_order);

  const have = new Map(mine.map((m) => [m.achievement_id, m.earned_at]));
  const fresh = catalogue.filter((a) => earned.has(a.code) && !have.has(a.id));
  if (fresh.length) {
    const now = new Date().toISOString();
    await localWrite(db, ['user_achievements'], async (w) => {
      for (const a of fresh) await w.upsert('user_achievements', { user_id: userId, achievement_id: a.id, earned_at: now });
    });
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
  const db = getDb();
  await localWrite(db, ['profiles'], (w) => w.update('profiles', userId, patch));
  const row = await db.profiles.get(userId);
  if (!row) throw new Error('Your profile is not available yet.');
  return row;
}

/** Everything stored for this account, as one JSON document. */
export async function exportMyData(): Promise<string> {
  if (!isOnline()) throw new Error('Export needs a connection.');
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
