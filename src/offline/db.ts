import Dexie, { type Table } from 'dexie';
import type {
  AchievementRow,
  ActivityLogRow,
  MoneyAccountRow,
  MoneyCategoryRow,
  MoneyRecordRow,
  PersonalRecordRow,
  PlanWorkoutRow,
  ProfileRow,
  SetLogRow,
  UserAchievementRow,
  UserPlanRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutSessionRow,
} from '../lib/database.types';
import type { OutboxOp } from './outbox';

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Local copy of the signed-in user's data, plus the queue of writes not yet pushed. */
export class PulseDB extends Dexie {
  profiles!: Table<ProfileRow, string>;
  workouts!: Table<WorkoutRow, string>;
  workout_exercises!: Table<WorkoutExerciseRow, string>;
  user_plans!: Table<UserPlanRow, string>;
  plan_workouts!: Table<PlanWorkoutRow, string>;
  workout_sessions!: Table<WorkoutSessionRow, string>;
  set_logs!: Table<SetLogRow, string>;
  activity_logs!: Table<ActivityLogRow, string>;
  personal_records!: Table<PersonalRecordRow, string>;
  achievements!: Table<AchievementRow, string>;
  user_achievements!: Table<UserAchievementRow, [string, string]>;
  money_accounts!: Table<MoneyAccountRow, string>;
  money_categories!: Table<MoneyCategoryRow, string>;
  money_records!: Table<MoneyRecordRow, string>;
  outbox!: Table<OutboxOp, number>;
  meta!: Table<MetaRow, string>;

  constructor(userId: string) {
    super(`pulse-${userId}`);
    this.version(1).stores({
      profiles: 'id',
      workouts: 'id, owner',
      workout_exercises: 'id, workout_id',
      user_plans: 'id, is_active',
      plan_workouts: 'id, plan_id, completed_session_id',
      workout_sessions: 'id, status, started_at',
      set_logs: 'id, session_id, exercise_id, logged_at',
      activity_logs: 'id, logged_at, session_id, type',
      personal_records: 'id',
      achievements: 'id, code',
      user_achievements: '[user_id+achievement_id]',
      money_accounts: 'id',
      money_categories: 'id, kind',
      money_records: 'id, occurred_at, account_id, to_account_id',
      outbox: '++seq, table, rowKey, status',
      meta: 'key',
    });
  }
}

let current: PulseDB | null = null;

/** Opens (creating if needed) the database for one user and makes it the current one. */
export async function openUserDb(userId: string): Promise<PulseDB> {
  if (current && current.name === `pulse-${userId}`) {
    if (!current.isOpen()) await current.open();
    return current;
  }
  current?.close();
  const db = new PulseDB(userId);
  await db.open();
  current = db;
  return db;
}

/** Closes the current database, e.g. on sign out. The data stays on disk. */
export function closeUserDb(): void {
  current?.close();
  current = null;
}

/** The open database for the signed-in user. Data modules call this outside React. */
export function getDb(): PulseDB {
  if (!current) throw new Error('The local database is not open yet.');
  return current;
}

/** Tables mirrored from the server (everything except outbox and meta). */
export const MIRRORED_TABLES = [
  'profiles',
  'workouts',
  'workout_exercises',
  'user_plans',
  'plan_workouts',
  'workout_sessions',
  'set_logs',
  'activity_logs',
  'personal_records',
  'achievements',
  'user_achievements',
  'money_accounts',
  'money_categories',
  'money_records',
] as const;
export type MirroredTable = (typeof MIRRORED_TABLES)[number];

/** Postgres numeric and bigint columns arrive from PostgREST as strings or big numbers. */
const NUMERIC_COLUMNS: Partial<Record<MirroredTable, string[]>> = {
  workout_exercises: ['start_load'],
  set_logs: ['weight_kg', 'stack_level'],
  activity_logs: ['distance_km'],
  personal_records: ['value'],
  money_accounts: ['opening_balance_centavos'],
  money_records: ['amount_centavos'],
};

/** Coerces numeric columns of a server row to numbers (null stays null). */
export function normalizeRow<T extends object>(table: MirroredTable, row: T): T {
  const cols = NUMERIC_COLUMNS[table];
  if (!cols) return row;
  const out = { ...row } as Record<string, unknown>;
  for (const c of cols) if (out[c] !== null && out[c] !== undefined) out[c] = Number(out[c]);
  return out as T;
}
