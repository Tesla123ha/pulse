import type { ActivityType } from './database.types';
import type { IconName } from '../components';

export interface ActivityMeta {
  type: ActivityType;
  label: string;
  icon: IconName;
  /** Whether the quick log asks for distance. */
  hasDistance: boolean;
  /** Rough energy estimate in kcal per minute, used when the user does not enter kcal. */
  kcalPerMin: number;
  /** Starting values for the first log of this type. */
  defaultMinutes: number;
  defaultKm?: number;
}

export const ACTIVITIES: ActivityMeta[] = [
  { type: 'run', label: 'Run', icon: 'run', hasDistance: true, kcalPerMin: 10, defaultMinutes: 30, defaultKm: 5 },
  { type: 'lift', label: 'Lift', icon: 'workouts', hasDistance: false, kcalPerMin: 6, defaultMinutes: 45 },
  { type: 'cycle', label: 'Cycle', icon: 'cycle', hasDistance: true, kcalPerMin: 8, defaultMinutes: 40, defaultKm: 12 },
  { type: 'sport', label: 'Sport', icon: 'sport', hasDistance: false, kcalPerMin: 7, defaultMinutes: 60 },
];

export const estimateKcal = (type: ActivityType, minutes: number) =>
  Math.round((ACTIVITIES.find((a) => a.type === type)?.kcalPerMin ?? 6) * minutes);
