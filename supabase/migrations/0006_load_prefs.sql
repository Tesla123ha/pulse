-- Pulse: the weight unit (kg, lb or PL) a user chose for each exercise.
-- Additive and safe to re-run. Run it by hand in the Supabase SQL editor.

create table if not exists public.exercise_load_prefs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  unit text not null check (unit in ('kg', 'lb', 'pl')),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercise_load_prefs enable row level security;

drop policy if exists "exercise_load_prefs: select own" on public.exercise_load_prefs;
drop policy if exists "exercise_load_prefs: insert own" on public.exercise_load_prefs;
drop policy if exists "exercise_load_prefs: update own" on public.exercise_load_prefs;
drop policy if exists "exercise_load_prefs: delete own" on public.exercise_load_prefs;

create policy "exercise_load_prefs: select own" on public.exercise_load_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "exercise_load_prefs: insert own" on public.exercise_load_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "exercise_load_prefs: update own" on public.exercise_load_prefs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercise_load_prefs: delete own" on public.exercise_load_prefs
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.exercise_load_prefs to authenticated;
revoke all on public.exercise_load_prefs from anon;
