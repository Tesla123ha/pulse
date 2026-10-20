// Database types for supabase/migrations/0001_init.sql.
// Regenerate with `npx supabase gen types typescript --linked > src/lib/database.types.ts`
// once the project is linked; keep this file in sync with migrations until then.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<FK extends string, Cols extends string, Ref extends string> = {
  foreignKeyName: FK;
  columns: [Cols];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Units = 'metric' | 'imperial';
export type WorkoutCategory = 'Strength' | 'Cardio' | 'HIIT' | 'Mobility' | 'Running';
export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'ended_early';
export type ActivityType = 'run' | 'lift' | 'cycle' | 'sport' | 'swim' | 'pickleball' | 'tennis';
export type LoadUnit = 'kg' | 'stack';
export type TargetType = 'reps' | 'max' | 'seconds';
export type SwimVenue = 'pool' | 'open_water';
export type MatchType = 'singles' | 'doubles';
export type RecordUnit = 'kg' | 'stack' | 'seconds' | 'km';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  workouts_per_week: number;
  move_goal_kcal: number;
  /** Daily active-time goal in minutes (Progress chart goal line). */
  active_goal_min: number;
  main_focus: string;
  units: Units;
  reminders_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutRow = {
  id: string;
  owner: string | null;
  name: string;
  category: WorkoutCategory;
  duration_min: number;
  level: string;
  equipment: string;
  created_at: string;
};

export type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  position: number;
  name: string;
  muscles: string[];
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  /** 'stack' = machine stack level, shown as PL. */
  load_unit: LoadUnit;
  target_type: TargetType;
  /** Load to start from before any history: kg or stack level. */
  start_load: number | null;
};

export type UserPlanRow = {
  id: string;
  user_id: string;
  name: string;
  total_weeks: number;
  started_on: string;
  is_active: boolean;
  created_at: string;
};

export type PlanWorkoutRow = {
  id: string;
  plan_id: string;
  workout_id: string;
  week_number: number;
  position: number;
  completed_session_id: string | null;
  completed_at: string | null;
};

export type WorkoutSessionRow = {
  id: string;
  user_id: string;
  workout_id: string;
  plan_workout_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  paused_at: string | null;
  paused_seconds: number;
  exercise_order: string[] | null;
  skipped_exercise_ids: string[];
  notes: string | null;
};

export type SetLogRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  /** Reps done, or seconds held for timed exercises. */
  reps: number;
  /** Stack level (PL) for machine exercises. */
  stack_level: number | null;
  logged_at: string;
};

export type ActivityLogRow = {
  id: string;
  user_id: string;
  type: ActivityType;
  distance_km: number | null;
  duration_min: number;
  kcal: number;
  logged_at: string;
  session_id: string | null;
  pace_sec_per_km: number | null;
  venue: SwimVenue | null;
  match_type: MatchType | null;
  wins: number | null;
  losses: number | null;
};

export type PersonalRecordRow = {
  id: string;
  user_id: string;
  name: string;
  value: number;
  unit: RecordUnit;
  achieved_on: string;
};

export type AchievementRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
};

export type UserAchievementRow = {
  user_id: string;
  achievement_id: string;
  earned_at: string;
};

export type AccountKind = 'cash' | 'bank' | 'ewallet' | 'card' | 'savings' | 'other';
export type MoneyRecordType = 'expense' | 'income' | 'transfer';

export type MoneyAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  opening_balance_centavos: number;
  sort_order: number;
  created_at: string;
};

export type MoneyCategoryRow = {
  id: string;
  user_id: string | null;
  kind: 'expense' | 'income';
  name: string;
  icon: string;
  sort_order: number;
};

export type MoneyRecordRow = {
  id: string;
  user_id: string;
  type: MoneyRecordType;
  amount_centavos: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
};

export type MoneyBalanceRow = {
  account_id: string;
  balance_centavos: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id'>;
      workouts: Table<WorkoutRow, 'name' | 'category' | 'duration_min' | 'level' | 'equipment'>;
      workout_exercises: Table<
        WorkoutExerciseRow,
        'workout_id' | 'position' | 'name' | 'target_sets' | 'rep_min' | 'rep_max',
        [Rel<'workout_exercises_workout_id_fkey', 'workout_id', 'workouts'>]
      >;
      user_plans: Table<UserPlanRow, 'user_id' | 'name' | 'total_weeks'>;
      plan_workouts: Table<
        PlanWorkoutRow,
        'plan_id' | 'workout_id' | 'week_number' | 'position',
        [
          Rel<'plan_workouts_plan_id_fkey', 'plan_id', 'user_plans'>,
          Rel<'plan_workouts_workout_id_fkey', 'workout_id', 'workouts'>,
        ]
      >;
      workout_sessions: Table<
        WorkoutSessionRow,
        'user_id' | 'workout_id',
        [Rel<'workout_sessions_workout_id_fkey', 'workout_id', 'workouts'>]
      >;
      set_logs: Table<
        SetLogRow,
        'session_id' | 'exercise_id' | 'set_number' | 'reps',
        [
          Rel<'set_logs_session_id_fkey', 'session_id', 'workout_sessions'>,
          Rel<'set_logs_exercise_id_fkey', 'exercise_id', 'workout_exercises'>,
        ]
      >;
      activity_logs: Table<
        ActivityLogRow,
        'user_id' | 'type' | 'duration_min',
        [Rel<'activity_logs_session_id_fkey', 'session_id', 'workout_sessions'>]
      >;
      personal_records: Table<PersonalRecordRow, 'user_id' | 'name' | 'value' | 'unit'>;
      achievements: Table<AchievementRow, 'code' | 'name' | 'description' | 'icon'>;
      money_accounts: Table<MoneyAccountRow, 'user_id' | 'name'>;
      money_categories: Table<MoneyCategoryRow, 'kind' | 'name'>;
      money_records: Table<MoneyRecordRow, 'user_id' | 'type' | 'amount_centavos' | 'account_id'>;
      user_achievements: Table<
        UserAchievementRow,
        'user_id' | 'achievement_id',
        [Rel<'user_achievements_achievement_id_fkey', 'achievement_id', 'achievements'>]
      >;
    };
    Views: {
      money_account_balances: { Row: MoneyBalanceRow; Relationships: [] };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
