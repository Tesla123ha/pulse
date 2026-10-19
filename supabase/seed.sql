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
