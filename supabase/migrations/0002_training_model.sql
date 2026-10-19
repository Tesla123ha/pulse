-- Pulse: training model from the user's existing FitTrack setup.
-- - Machine exercises are loaded by stack level ("PL"), not kilograms.
-- - Some exercises target max reps or a timed hold instead of a rep range.
-- - Exercises carry a starting load used before any history exists.
-- - Quick log covers swim, pickleball and tennis, with match details.

-- ---------------------------------------------------------------------------
-- workout_exercises: load unit, target type, starting load
-- ---------------------------------------------------------------------------
alter table public.workout_exercises
  add column load_unit text not null default 'kg' check (load_unit in ('kg', 'stack')),
  add column target_type text not null default 'reps' check (target_type in ('reps', 'max', 'seconds')),
  -- In kg for 'kg' exercises, stack level for 'stack' exercises
  add column start_load numeric(6, 2) check (start_load >= 0);

comment on column public.workout_exercises.rep_min is
  'Reps for target_type reps; seconds for target_type seconds; unused (1) for max.';

-- ---------------------------------------------------------------------------
-- set_logs: stack level for machine exercises
-- ---------------------------------------------------------------------------
alter table public.set_logs
  add column stack_level numeric(5, 1) check (stack_level >= 0);

comment on column public.set_logs.reps is 'Reps done, or seconds held for timed exercises.';
comment on column public.set_logs.stack_level is 'Machine stack level (PL) when the exercise load_unit is stack.';

-- ---------------------------------------------------------------------------
-- personal_records: allow stack-level records
-- ---------------------------------------------------------------------------
alter table public.personal_records drop constraint personal_records_unit_check;
alter table public.personal_records
  add constraint personal_records_unit_check check (unit in ('kg', 'stack', 'seconds', 'km'));

-- ---------------------------------------------------------------------------
-- activity_logs: swim, pickleball, tennis and their details
-- ---------------------------------------------------------------------------
alter table public.activity_logs drop constraint activity_logs_type_check;
alter table public.activity_logs
  add constraint activity_logs_type_check
  check (type in ('run', 'lift', 'cycle', 'sport', 'swim', 'pickleball', 'tennis'));

alter table public.activity_logs
  add column pace_sec_per_km integer check (pace_sec_per_km > 0),
  add column venue text check (venue in ('pool', 'open_water')),
  add column match_type text check (match_type in ('singles', 'doubles')),
  add column wins smallint check (wins >= 0),
  add column losses smallint check (losses >= 0);

-- ---------------------------------------------------------------------------
-- Default plan: the four splits, four weeks
-- ---------------------------------------------------------------------------
create or replace function public.enrol_default_plan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_splits uuid[];
  v_week int;
  v_i int;
  v_pos int := 0;
begin
  select array_agg(id order by ord) into v_splits
  from (
    select w.id, array_position(array['Push', 'Pull', 'Lower', 'Upper'], w.name) as ord
    from public.workouts w
    where w.owner is null and w.name in ('Push', 'Pull', 'Lower', 'Upper')
  ) s;

  -- Splits not seeded yet: skip; the app shows the workout library instead.
  if v_splits is null or array_length(v_splits, 1) < 4 then
    return;
  end if;

  insert into public.user_plans (user_id, name, total_weeks)
  values (p_user_id, '4-Week Strength Builder', 4)
  returning id into v_plan_id;

  for v_week in 1..4 loop
    for v_i in 1..4 loop
      v_pos := v_pos + 1;
      insert into public.plan_workouts (plan_id, workout_id, week_number, position)
      values (v_plan_id, v_splits[v_i], v_week, v_pos);
    end loop;
  end loop;
end;
$$;

revoke execute on function public.enrol_default_plan(uuid) from public, anon, authenticated;
