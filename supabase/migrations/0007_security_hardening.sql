-- Pulse: security hardening. Additive and safe to re-run. Run it by hand in the
-- Supabase SQL editor (it is not applied automatically).
--
-- 1. Least privilege: signed-in users keep only the table privileges the app
--    and the row level security policies actually use. Supabase grants every
--    privilege to `authenticated` by default, including TRUNCATE, which row
--    level security does not cover.
-- 2. Bounds and length limits on user-controlled values, so one bad client
--    cannot store absurd numbers or megabytes of text.
-- Nothing here changes or deletes existing rows. Constraints are added NOT
-- VALID and then validated, so a row that breaks a limit shows up as an error
-- you can inspect instead of being silently changed.

-- ---------------------------------------------------------------------------
-- 1. Least-privilege grants
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Read-only catalogue
grant select on public.achievements to authenticated;

-- Own rows, full read and write (policies restrict to the signed-in user)
grant select, insert, update, delete on
  public.activity_logs,
  public.exercise_load_prefs,
  public.money_accounts,
  public.money_categories,
  public.money_records,
  public.personal_records,
  public.plan_workouts,
  public.set_logs,
  public.user_plans,
  public.workout_exercises,
  public.workout_sessions,
  public.workouts
to authenticated;

-- Profile: created by a trigger at signup, edited by the owner, never deleted by the client
grant select, update on public.profiles to authenticated;

-- Earned achievements: the client records them, never edits or removes them
grant select, insert on public.user_achievements to authenticated;

grant select on public.money_account_balances to authenticated;

-- Trigger helper: never needs to be callable through the API
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Future tables must be granted explicitly, never by default
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bounds and length limits
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('profiles', 'profiles_display_name_len', 'display_name is null or length(display_name) <= 60'),
      ('profiles', 'profiles_main_focus_len', 'length(main_focus) <= 60'),
      ('profiles', 'profiles_goals_max', 'move_goal_kcal <= 20000 and active_goal_min <= 1440'),
      ('workouts', 'workouts_name_len', 'length(name) between 1 and 80'),
      ('workouts', 'workouts_text_len', 'length(equipment) <= 80 and length(level) <= 40'),
      ('workouts', 'workouts_duration_max', 'duration_min <= 1440'),
      ('workout_sessions', 'workout_sessions_notes_len', 'notes is null or length(notes) <= 2000'),
      ('activity_logs', 'activity_logs_max', 'duration_min <= 1440 and kcal <= 20000 and distance_km <= 1000 and wins <= 1000 and losses <= 1000'),
      ('set_logs', 'set_logs_max', 'reps <= 1000 and weight_kg <= 2000 and stack_level <= 2000 and set_number <= 100'),
      ('money_records', 'money_records_amount_max', 'amount_centavos <= 100000000000'),
      ('money_accounts', 'money_accounts_opening_max', 'abs(opening_balance_centavos) <= 100000000000000')
    ) as t(tbl, name, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    execute format('alter table public.%I validate constraint %I', c.tbl, c.name);
  end loop;
end
$$;
