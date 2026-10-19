-- Pulse seed: built-in workouts (owner null) and the achievement catalogue.
-- Idempotent: safe to run more than once.

insert into public.workouts (id, owner, name, category, duration_min, level, equipment) values
  ('00000000-0000-4000-8000-000000000001', null, 'Upper Body Strength', 'Strength', 45, 'Intermediate', 'Dumbbells'),
  ('00000000-0000-4000-8000-000000000002', null, 'Full Body Basics',    'Strength', 30, 'Beginner',     'Dumbbells'),
  ('00000000-0000-4000-8000-000000000003', null, '20-Min HIIT Burner',  'HIIT',     20, 'Intermediate', 'Bodyweight'),
  ('00000000-0000-4000-8000-000000000004', null, 'Easy Run Intervals',  'Running',  35, 'Beginner',     'Outdoor'),
  ('00000000-0000-4000-8000-000000000005', null, 'Mobility Reset',      'Mobility', 15, 'All levels',   'Mat')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  duration_min = excluded.duration_min,
  level = excluded.level,
  equipment = excluded.equipment;

-- Upper Body Strength: 6 exercises
insert into public.workout_exercises (id, workout_id, position, name, muscles, target_sets, rep_min, rep_max, rest_seconds) values
  ('00000000-0000-4000-8001-000000000101', '00000000-0000-4000-8000-000000000001', 1, 'Dumbbell Bench Press',       '{Chest,Triceps}',    4, 8,  10, 90),
  ('00000000-0000-4000-8001-000000000102', '00000000-0000-4000-8000-000000000001', 2, 'One-Arm Dumbbell Row',       '{Back,Biceps}',      4, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000103', '00000000-0000-4000-8000-000000000001', 3, 'Incline Dumbbell Press',     '{Chest,Shoulders}',  4, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000104', '00000000-0000-4000-8000-000000000001', 4, 'Lateral Raise',              '{Shoulders}',        3, 15, 15, 90),
  ('00000000-0000-4000-8001-000000000105', '00000000-0000-4000-8000-000000000001', 5, 'Dumbbell Biceps Curl',       '{Biceps}',           3, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000106', '00000000-0000-4000-8000-000000000001', 6, 'Overhead Triceps Extension', '{Triceps}',          3, 10, 12, 90)
on conflict (id) do update set
  position = excluded.position, name = excluded.name, muscles = excluded.muscles,
  target_sets = excluded.target_sets, rep_min = excluded.rep_min, rep_max = excluded.rep_max,
  rest_seconds = excluded.rest_seconds;

-- Full Body Basics: the other half of the 4-Week Strength Builder
insert into public.workout_exercises (id, workout_id, position, name, muscles, target_sets, rep_min, rep_max, rest_seconds) values
  ('00000000-0000-4000-8001-000000000201', '00000000-0000-4000-8000-000000000002', 1, 'Goblet Squat',              '{Quads,Glutes}',     3, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000202', '00000000-0000-4000-8000-000000000002', 2, 'Dumbbell Romanian Deadlift', '{Hamstrings,Glutes}', 3, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000203', '00000000-0000-4000-8000-000000000002', 3, 'Dumbbell Floor Press',      '{Chest,Triceps}',    3, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000204', '00000000-0000-4000-8000-000000000002', 4, 'Bent-Over Dumbbell Row',    '{Back,Biceps}',      3, 10, 12, 90),
  ('00000000-0000-4000-8001-000000000205', '00000000-0000-4000-8000-000000000002', 5, 'Dumbbell Shoulder Press',   '{Shoulders}',        3, 8,  10, 90)
on conflict (id) do update set
  position = excluded.position, name = excluded.name, muscles = excluded.muscles,
  target_sets = excluded.target_sets, rep_min = excluded.rep_min, rep_max = excluded.rep_max,
  rest_seconds = excluded.rest_seconds;

insert into public.achievements (code, name, description, icon, sort_order) values
  ('streak_7',     '7-day streak',  'Be active seven days in a row.',  'bolt', 1),
  ('first_5k',     'First 5K',      'Log a run of 5 km or more.',      'run',  2),
  ('workouts_100', '100 workouts',  'Finish 100 workouts.',            'workouts', 3)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Training splits (from the user's FitTrack program). Requires 0002.
-- load_unit 'stack' = machine stack level, shown as PL.
-- ---------------------------------------------------------------------------
insert into public.workouts (id, owner, name, category, duration_min, level, equipment) values
  ('00000000-0000-4000-8000-000000000011', null, 'Push',  'Strength', 60, 'Intermediate', 'Gym'),
  ('00000000-0000-4000-8000-000000000012', null, 'Pull',  'Strength', 60, 'Intermediate', 'Gym'),
  ('00000000-0000-4000-8000-000000000013', null, 'Lower', 'Strength', 45, 'Intermediate', 'Gym'),
  ('00000000-0000-4000-8000-000000000014', null, 'Upper', 'Strength', 60, 'Intermediate', 'Gym')
on conflict (id) do update set
  name = excluded.name, category = excluded.category, duration_min = excluded.duration_min,
  level = excluded.level, equipment = excluded.equipment;

insert into public.workout_exercises
  (id, workout_id, position, name, muscles, target_sets, rep_min, rep_max, rest_seconds, load_unit, target_type, start_load)
values
  -- Push: Chest · Shoulders · Triceps
  ('00000000-0000-4000-8001-000000001101', '00000000-0000-4000-8000-000000000011',  1, 'Incline DB Bench Press',                     '{Chest}',     3,  8,  8, 90, 'stack', 'reps', 12),
  ('00000000-0000-4000-8001-000000001102', '00000000-0000-4000-8000-000000000011',  2, 'Flat DB Bench Press',                        '{Chest}',     3,  8,  8, 90, 'stack', 'reps', 12),
  ('00000000-0000-4000-8001-000000001103', '00000000-0000-4000-8000-000000000011',  3, 'Dumbbell Flys',                              '{Chest}',     3, 12, 12, 90, 'kg',    'reps', 7.5),
  ('00000000-0000-4000-8001-000000001104', '00000000-0000-4000-8000-000000000011',  4, 'DB Overhead Press',                          '{Shoulders}', 3,  8,  8, 90, 'kg',    'reps', 10),
  ('00000000-0000-4000-8001-000000001105', '00000000-0000-4000-8000-000000000011',  5, 'Lateral Raises',                             '{Shoulders}', 3,  8,  8, 90, 'kg',    'reps', 12.5),
  ('00000000-0000-4000-8001-000000001106', '00000000-0000-4000-8000-000000000011',  6, 'Face Pulls',                                 '{Shoulders}', 3,  8,  8, 90, 'stack', 'reps', 6),
  ('00000000-0000-4000-8001-000000001107', '00000000-0000-4000-8000-000000000011',  7, 'JM Press',                                   '{Triceps}',   3,  8,  8, 90, 'kg',    'reps', 10),
  ('00000000-0000-4000-8001-000000001108', '00000000-0000-4000-8000-000000000011',  8, 'Tricep Pushdown / DB OH Tricep Extension',   '{Triceps}',   3,  8,  8, 90, 'stack', 'reps', 3),
  ('00000000-0000-4000-8001-000000001109', '00000000-0000-4000-8000-000000000011',  9, 'Plank Scapular Protraction',                 '{Core}',      3, 15, 15, 60, 'kg',    'reps', 0),
  ('00000000-0000-4000-8001-000000001110', '00000000-0000-4000-8000-000000000011', 10, 'Decline Russian Twists',                     '{Core}',      3, 20, 20, 60, 'kg',    'reps', 0),
  -- Pull: Back · Biceps
  ('00000000-0000-4000-8001-000000001201', '00000000-0000-4000-8000-000000000012',  1, 'Wide Grip Lat Pulldown',     '{Back}',   3,  8,  8, 90, 'stack', 'reps', 9),
  ('00000000-0000-4000-8001-000000001202', '00000000-0000-4000-8000-000000000012',  2, 'Close Grip Seated Row',      '{Back}',   3,  8,  8, 90, 'stack', 'reps', 10),
  ('00000000-0000-4000-8001-000000001203', '00000000-0000-4000-8000-000000000012',  3, 'Rope Pullover',              '{Back}',   3,  8,  8, 90, 'stack', 'reps', 3),
  ('00000000-0000-4000-8001-000000001204', '00000000-0000-4000-8000-000000000012',  4, 'Single-Arm Machine Row',     '{Back}',   3,  8,  8, 90, 'stack', 'reps', 3),
  ('00000000-0000-4000-8001-000000001205', '00000000-0000-4000-8000-000000000012',  5, 'Shrugs',                     '{Back}',   3,  8,  8, 90, 'kg',    'reps', 25),
  ('00000000-0000-4000-8001-000000001206', '00000000-0000-4000-8000-000000000012',  6, 'Bayesian Curls',             '{Biceps}', 3,  8,  8, 90, 'stack', 'reps', 2),
  ('00000000-0000-4000-8001-000000001207', '00000000-0000-4000-8000-000000000012',  7, 'Hammer Curls',               '{Biceps}', 3,  8,  8, 90, 'kg',    'reps', 12.5),
  ('00000000-0000-4000-8001-000000001208', '00000000-0000-4000-8000-000000000012',  8, 'Dumbbell Preacher Curl',     '{Biceps}', 3,  8,  8, 90, 'kg',    'reps', 10),
  ('00000000-0000-4000-8001-000000001209', '00000000-0000-4000-8000-000000000012',  9, 'Leg Raises',                 '{Core}',   3, 12, 12, 60, 'kg',    'reps', 0),
  ('00000000-0000-4000-8001-000000001210', '00000000-0000-4000-8000-000000000012', 10, 'Ab Kickouts',                '{Core}',   3, 12, 12, 60, 'kg',    'reps', 0),
  -- Lower: Quads · Hamstrings · Glutes
  ('00000000-0000-4000-8001-000000001301', '00000000-0000-4000-8000-000000000013', 1, 'Goblet Squat',            '{Quads,Glutes}',     3,  8,  8, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001302', '00000000-0000-4000-8000-000000000013', 2, 'Bulgarian Split Squats',  '{Quads,Glutes}',     3, 10, 10, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001303', '00000000-0000-4000-8000-000000000013', 3, 'RDLs',                    '{Hamstrings,Glutes}', 3,  8,  8, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001304', '00000000-0000-4000-8000-000000000013', 4, 'Hip Thrusts',             '{Glutes}',           3,  8,  8, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001305', '00000000-0000-4000-8000-000000000013', 5, 'Leg Extensions',          '{Quads}',            3, 10, 10, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001306', '00000000-0000-4000-8000-000000000013', 6, 'Leg Curls',               '{Hamstrings}',       3, 10, 10, 90, 'kg', 'reps', 0),
  ('00000000-0000-4000-8001-000000001307', '00000000-0000-4000-8000-000000000013', 7, 'Dumbbell Calf Raises',    '{Calves}',           3, 15, 15, 60, 'kg', 'reps', 0),
  -- Upper: Push & Pull
  ('00000000-0000-4000-8001-000000001401', '00000000-0000-4000-8000-000000000014',  1, 'Decline DB Bench Press',          '{Chest}',     3,  8,  8, 90, 'kg',    'reps',    12.5),
  ('00000000-0000-4000-8001-000000001402', '00000000-0000-4000-8000-000000000014',  2, 'Incline DB Bench Press',          '{Chest}',     3,  8,  8, 90, 'stack', 'reps',    11),
  ('00000000-0000-4000-8001-000000001403', '00000000-0000-4000-8000-000000000014',  3, 'Standard Push-ups',               '{Chest}',     3,  1,  1, 90, 'kg',    'max',     0),
  ('00000000-0000-4000-8001-000000001404', '00000000-0000-4000-8000-000000000014',  4, 'Overhead Press',                  '{Shoulders}', 3,  8,  8, 90, 'kg',    'reps',    12.5),
  ('00000000-0000-4000-8001-000000001405', '00000000-0000-4000-8000-000000000014',  5, 'Bent-Over DB Rows',               '{Back}',      3,  8,  8, 90, 'kg',    'reps',    15),
  ('00000000-0000-4000-8001-000000001406', '00000000-0000-4000-8000-000000000014',  6, 'Close Grip Lat Pulldown',         '{Back}',      3,  8,  8, 90, 'stack', 'reps',    10),
  ('00000000-0000-4000-8001-000000001407', '00000000-0000-4000-8000-000000000014',  7, 'Cable Face Pulls with High Hold', '{Shoulders}', 3,  8,  8, 90, 'stack', 'reps',    5),
  ('00000000-0000-4000-8001-000000001408', '00000000-0000-4000-8000-000000000014',  8, 'Single-Arm Triceps Extension',    '{Triceps}',   3,  8,  8, 90, 'stack', 'reps',    2),
  ('00000000-0000-4000-8001-000000001409', '00000000-0000-4000-8000-000000000014',  9, 'Hammer Curls',                    '{Biceps}',    3,  8,  8, 90, 'kg',    'reps',    12.5),
  ('00000000-0000-4000-8001-000000001410', '00000000-0000-4000-8000-000000000014', 10, 'Forearms',                        '{Forearms}',  3,  8,  8, 90, 'stack', 'reps',    4),
  ('00000000-0000-4000-8001-000000001411', '00000000-0000-4000-8000-000000000014', 11, 'Scapular Push-ups',               '{Core}',      3, 15, 15, 60, 'kg',    'reps',    0),
  ('00000000-0000-4000-8001-000000001412', '00000000-0000-4000-8000-000000000014', 12, 'Static Sit-Ups',                  '{Core}',      3, 30, 30, 60, 'kg',    'seconds', 0)
on conflict (id) do update set
  position = excluded.position, name = excluded.name, muscles = excluded.muscles,
  target_sets = excluded.target_sets, rep_min = excluded.rep_min, rep_max = excluded.rep_max,
  rest_seconds = excluded.rest_seconds, load_unit = excluded.load_unit,
  target_type = excluded.target_type, start_load = excluded.start_load;

-- Move existing accounts onto the split plan. Only plans that have not been
-- started (no finished slot) and are not already on the splits are rebuilt;
-- accounts without an active plan are enrolled.
do $$
declare
  r record;
begin
  for r in
    select p.id, p.user_id
    from public.user_plans p
    where p.is_active
      and not exists (
        select 1 from public.plan_workouts pw where pw.plan_id = p.id and pw.completed_at is not null
      )
      and not exists (
        select 1 from public.plan_workouts pw
        join public.workouts w on w.id = pw.workout_id
        where pw.plan_id = p.id and w.owner is null and w.name in ('Push', 'Pull', 'Lower', 'Upper')
      )
  loop
    delete from public.user_plans where id = r.id;
    perform public.enrol_default_plan(r.user_id);
  end loop;

  for r in
    select u.id from auth.users u
    where not exists (select 1 from public.user_plans p where p.user_id = u.id and p.is_active)
  loop
    perform public.enrol_default_plan(r.id);
  end loop;
end;
$$;
