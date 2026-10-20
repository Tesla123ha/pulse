import type {
  ActivityLogRow,
  MoneyAccountRow,
  MoneyRecordRow,
  PersonalRecordRow,
  SetLogRow,
  WorkoutSessionRow,
} from '../lib/database.types';
import { newId } from './ids';

type Fields<R, Req extends keyof R> = Pick<R, Req> & Partial<Omit<R, Req>>;

const now = () => new Date().toISOString();

// Builders return complete rows with the same defaults the database applies,
// so a row created offline is identical to the one the server would store.

export function newSessionRow(f: Fields<WorkoutSessionRow, 'user_id' | 'workout_id'>): WorkoutSessionRow {
  return {
    id: newId(),
    plan_workout_id: null,
    started_at: now(),
    ended_at: null,
    status: 'in_progress',
    paused_at: null,
    paused_seconds: 0,
    exercise_order: null,
    skipped_exercise_ids: [],
    notes: null,
    ...f,
  };
}

export function newSetLogRow(f: Fields<SetLogRow, 'session_id' | 'exercise_id' | 'set_number' | 'reps'>): SetLogRow {
  return { id: newId(), weight_kg: 0, stack_level: null, logged_at: now(), ...f };
}

export function newActivityRow(f: Fields<ActivityLogRow, 'user_id' | 'type' | 'duration_min'>): ActivityLogRow {
  return {
    id: newId(),
    distance_km: null,
    kcal: 0,
    logged_at: now(),
    session_id: null,
    pace_sec_per_km: null,
    venue: null,
    match_type: null,
    wins: null,
    losses: null,
    ...f,
  };
}

export function newAccountRow(f: Fields<MoneyAccountRow, 'user_id' | 'name'>): MoneyAccountRow {
  return {
    id: newId(),
    kind: 'cash',
    currency: 'PHP',
    opening_balance_centavos: 0,
    sort_order: 0,
    created_at: now(),
    ...f,
  };
}

export function newRecordRow(
  f: Fields<MoneyRecordRow, 'user_id' | 'type' | 'amount_centavos' | 'account_id'>,
): MoneyRecordRow {
  const t = now();
  return { id: newId(), to_account_id: null, category_id: null, note: null, occurred_at: t, created_at: t, ...f };
}

export function newPersonalRecordRow(f: Fields<PersonalRecordRow, 'user_id' | 'name' | 'value' | 'unit'>): PersonalRecordRow {
  return { id: newId(), achieved_on: now().slice(0, 10), ...f };
}
