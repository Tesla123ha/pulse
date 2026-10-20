-- Pulse: daily active-time goal, drawn as the goal line on the Progress chart.
alter table public.profiles
  add column active_goal_min smallint not null default 45 check (active_goal_min > 0);
