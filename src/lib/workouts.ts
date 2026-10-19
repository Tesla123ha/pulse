import type { IconName } from '../components';
import type { WorkoutCategory, WorkoutRow } from './database.types';
import type { WorkoutWithExercises } from '../data/workouts';

export const FILTERS = ['All', 'Strength', 'Cardio', 'HIIT', 'Mobility', 'Running'] as const;
export type WorkoutFilter = (typeof FILTERS)[number];

/** Cardio covers every heart-rate category; the others match one category. */
const FILTER_CATEGORIES: Record<Exclude<WorkoutFilter, 'All'>, WorkoutCategory[]> = {
  Strength: ['Strength'],
  Cardio: ['Cardio', 'HIIT', 'Running'],
  HIIT: ['HIIT'],
  Mobility: ['Mobility'],
  Running: ['Running'],
};

export const CATEGORY_ICON: Record<WorkoutCategory, IconName> = {
  Strength: 'workouts',
  Cardio: 'run',
  HIIT: 'bolt',
  Mobility: 'mobility',
  Running: 'run',
};

export const workoutCaption = (w: Pick<WorkoutRow, 'duration_min' | 'level' | 'equipment'>) =>
  `${w.duration_min} min · ${w.level} · ${w.equipment}`;

/** Filter by chip and search text (name, equipment or any exercise), plan workouts first. */
export function filterWorkouts(
  workouts: WorkoutWithExercises[],
  filter: WorkoutFilter,
  query: string,
  planIds: string[],
): WorkoutWithExercises[] {
  const q = query.trim().toLowerCase();
  const rank = (w: WorkoutRow) => {
    const i = planIds.indexOf(w.id);
    return i === -1 ? planIds.length : i;
  };
  return workouts
    .filter((w) => filter === 'All' || FILTER_CATEGORIES[filter].includes(w.category))
    .filter(
      (w) =>
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.equipment.toLowerCase().includes(q) ||
        w.exercises.some((e) => e.name.toLowerCase().includes(q)),
    )
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
