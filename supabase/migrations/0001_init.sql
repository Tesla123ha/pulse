-- Pulse: initial schema
-- All measurements are stored in metric (kg, km, kcal, minutes, seconds).
-- The client converts for display using profiles.units.
-- Row level security is enabled on every table: users read and write only
-- their own rows; built-in workouts (owner is null) and the achievement
-- catalogue are readable by every signed-in user.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  workouts_per_week smallint not null default 4 check (workouts_per_week between 1 and 7),
  move_goal_kcal integer not null default 600 check (move_goal_kcal > 0),
  calorie_goal integer not null default 2200 check (calorie_goal > 0),
  protein_goal_g integer not null default 140 check (protein_goal_g >= 0),
  carbs_goal_g integer not null default 240 check (carbs_goal_g >= 0),
  fat_goal_g integer not null default 70 check (fat_goal_g >= 0),
  water_goal_glasses smallint not null default 8 check (water_goal_glasses > 0),
  main_focus text not null default 'Build strength',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workouts and exercises (owner null = built-in template)
-- ---------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('Strength', 'Cardio', 'HIIT', 'Mobility', 'Running')),
  duration_min integer not null check (duration_min > 0),
  level text not null,
  equipment text not null,
  created_at timestamptz not null default now()
);
create index workouts_owner_idx on public.workouts (owner);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position smallint not null,
  name text not null,
  muscles text[] not null default '{}',
  target_sets smallint not null check (target_sets > 0),
  rep_min smallint not null check (rep_min > 0),
  rep_max smallint not null check (rep_max >= rep_min),
  rest_seconds smallint not null default 90 check (rest_seconds >= 0),
  unique (workout_id, position)
);

-- ---------------------------------------------------------------------------
-- plans (4-Week Strength Builder progress)
-- ---------------------------------------------------------------------------
create table public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  total_weeks smallint not null check (total_weeks > 0),
  started_on date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index user_plans_user_idx on public.user_plans (user_id);
-- One active plan per user
create unique index user_plans_one_active on public.user_plans (user_id) where is_active;

create table public.plan_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.user_plans (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete restrict,
  week_number smallint not null check (week_number > 0),
  position smallint not null,
  completed_session_id uuid,
  completed_at timestamptz,
  unique (plan_id, position)
);

-- ---------------------------------------------------------------------------
-- workout sessions and set logs
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete restrict,
  plan_workout_id uuid references public.plan_workouts (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'paused', 'completed', 'ended_early')),
  -- Pause bookkeeping so elapsed time excludes pauses
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  -- Session-level edits: exercise order after swaps, and skipped exercises
  exercise_order uuid[],
  skipped_exercise_ids uuid[] not null default '{}',
  notes text
);
create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);
-- At most one open session per user
create unique index workout_sessions_one_open on public.workout_sessions (user_id)
  where status in ('in_progress', 'paused');

alter table public.plan_workouts
  add constraint plan_workouts_completed_session_fk
  foreign key (completed_session_id) references public.workout_sessions (id) on delete set null;

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.workout_exercises (id) on delete restrict,
  set_number smallint not null check (set_number > 0),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps smallint not null check (reps >= 0),
  logged_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);
create index set_logs_exercise_idx on public.set_logs (exercise_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- activity, nutrition, water
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('run', 'lift', 'cycle', 'sport')),
  distance_km numeric(7, 2) check (distance_km >= 0),
  duration_min integer not null check (duration_min >= 0),
  kcal integer not null default 0 check (kcal >= 0),
  logged_at timestamptz not null default now(),
  -- Set when the activity was produced by finishing a workout session
  session_id uuid references public.workout_sessions (id) on delete set null
);
create index activity_logs_user_idx on public.activity_logs (user_id, logged_at desc);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snacks', 'dinner')),
  description text not null,
  kcal integer not null check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index food_entries_user_day_idx on public.food_entries (user_id, logged_on);

create table public.water_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  glasses smallint not null default 0 check (glasses >= 0),
  primary key (user_id, logged_on)
);

-- ---------------------------------------------------------------------------
-- records and achievements
-- ---------------------------------------------------------------------------
-- One row per record set; the previous row with the same name gives the delta.
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  value numeric(10, 2) not null,
  -- 'kg' for lifts, 'seconds' for timed efforts, 'km' for distance
  unit text not null check (unit in ('kg', 'seconds', 'km')),
  achieved_on date not null default current_date
);
create index personal_records_user_idx on public.personal_records (user_id, name, achieved_on desc);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  sort_order smallint not null default 0
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.user_plans enable row level security;
alter table public.plan_workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.food_entries enable row level security;
alter table public.water_logs enable row level security;
alter table public.personal_records enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- profiles: own row only (rows are created by the signup trigger)
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workouts: built-ins readable by everyone signed in; custom workouts are owner only
create policy "workouts: read built-in and own" on public.workouts
  for select to authenticated using (owner is null or owner = (select auth.uid()));
create policy "workouts: insert own" on public.workouts
  for insert to authenticated with check (owner = (select auth.uid()));
create policy "workouts: update own" on public.workouts
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "workouts: delete own" on public.workouts
  for delete to authenticated using (owner = (select auth.uid()));

-- workout_exercises: follow the parent workout
create policy "workout_exercises: read built-in and own" on public.workout_exercises
  for select to authenticated using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and (w.owner is null or w.owner = (select auth.uid()))
    )
  );
create policy "workout_exercises: write own" on public.workout_exercises
  for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.owner = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.owner = (select auth.uid())));

-- Tables keyed directly by user_id
create policy "user_plans: own" on public.user_plans
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_sessions: own" on public.workout_sessions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "activity_logs: own" on public.activity_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "food_entries: own" on public.food_entries
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "water_logs: own" on public.water_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "personal_records: own" on public.personal_records
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_achievements: read own" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_achievements: insert own" on public.user_achievements
  for insert to authenticated with check (user_id = (select auth.uid()));

-- plan_workouts: follow the parent plan
create policy "plan_workouts: own" on public.plan_workouts
  for all to authenticated
  using (exists (select 1 from public.user_plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.user_plans p where p.id = plan_id and p.user_id = (select auth.uid())));

-- set_logs: follow the parent session
create policy "set_logs: own" on public.set_logs
  for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

-- achievements: catalogue readable by everyone signed in
create policy "achievements: read" on public.achievements
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Grants (anon gets nothing; every screen requires sign-in)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
revoke all on all tables in schema public from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.user_plans to authenticated;
grant select, insert, update, delete on public.plan_workouts to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.set_logs to authenticated;
grant select, insert, update, delete on public.activity_logs to authenticated;
grant select, insert, update, delete on public.food_entries to authenticated;
grant select, insert, update, delete on public.water_logs to authenticated;
grant select, insert, update, delete on public.personal_records to authenticated;
grant select on public.achievements to authenticated;
grant select, insert on public.user_achievements to authenticated;

-- ---------------------------------------------------------------------------
-- Signup: create the profile and enrol the default plan
-- ---------------------------------------------------------------------------
create or replace function public.enrol_default_plan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_upper uuid;
  v_full uuid;
  i int;
begin
  select id into v_upper from public.workouts where owner is null and name = 'Upper Body Strength' limit 1;
  select id into v_full from public.workouts where owner is null and name = 'Full Body Basics' limit 1;
  -- Built-in workouts not seeded yet: skip; the app shows recommended workouts instead.
  if v_upper is null or v_full is null then
    return;
  end if;

  insert into public.user_plans (user_id, name, total_weeks)
  values (p_user_id, '4-Week Strength Builder', 4)
  returning id into v_plan_id;

  -- Two workouts a week for four weeks, alternating upper body and full body.
  for i in 1..8 loop
    insert into public.plan_workouts (plan_id, workout_id, week_number, position)
    values (v_plan_id, case when i % 2 = 1 then v_upper else v_full end, (i + 1) / 2, i);
  end loop;
end;
$$;

revoke execute on function public.enrol_default_plan(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));

  perform public.enrol_default_plan(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
