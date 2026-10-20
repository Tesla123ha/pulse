import type { ProfileRow, Units } from './database.types';
import { formatInt } from './format';

export const FOCUS_OPTIONS = ['Build strength', 'Lose fat', 'Improve endurance', 'Stay active'] as const;

export type GoalField = 'workouts_per_week' | 'move_goal_kcal' | 'active_goal_min' | 'main_focus';
export type EditField = GoalField | 'display_name' | 'units';

export const GOAL_ROWS: { field: GoalField; label: string; value: (p: ProfileRow) => string }[] = [
  { field: 'workouts_per_week', label: 'Workouts per week', value: (p) => `${p.workouts_per_week} ${p.workouts_per_week === 1 ? 'day' : 'days'}` },
  { field: 'move_goal_kcal', label: 'Daily move goal', value: (p) => `${formatInt(p.move_goal_kcal)} kcal` },
  { field: 'active_goal_min', label: 'Daily active time', value: (p) => `${formatInt(p.active_goal_min)} min` },
  { field: 'main_focus', label: 'Main focus', value: (p) => p.main_focus },
];

export const unitsText = (u: Units) => (u === 'imperial' ? 'lb · mi' : 'kg · km');

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
export const memberSince = (createdAt: string) => `Member since ${MONTH_YEAR.format(new Date(createdAt))}`;
