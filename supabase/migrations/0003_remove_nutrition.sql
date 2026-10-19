-- Pulse: remove nutrition tracking.
-- Drops food and water logs and the nutrition goals on profiles.
-- This deletes any rows in those tables; the app no longer reads or writes them.

drop table if exists public.food_entries;
drop table if exists public.water_logs;

alter table public.profiles
  drop column if exists calorie_goal,
  drop column if exists protein_goal_g,
  drop column if exists carbs_goal_g,
  drop column if exists fat_goal_g,
  drop column if exists water_goal_glasses;
