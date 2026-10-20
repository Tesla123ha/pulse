import type { ActivityLogRow, ActivityType, Units } from './database.types';
import type { IconName } from '../components';
import { formatInt } from './format';
import { formatDistance } from './units';

/** Which quick-log form an activity uses. */
export type ActivityKind = 'run' | 'swim' | 'match' | 'basic';

export interface ActivityMeta {
  type: ActivityType;
  /** Short tile label. */
  label: string;
  /** Word used in sentences: "Log pickleball". */
  noun: string;
  icon: IconName;
  kind: ActivityKind;
  /** Shown as a Quick log tile on Home. Lifting is logged through workout sessions. */
  quickLog: boolean;
  /** Rough energy estimate in kcal per minute. */
  kcalPerMin: number;
  /** Starting duration for the first log of this type. */
  defaultMinutes: number;
}

export const ACTIVITIES: ActivityMeta[] = [
  { type: 'run', label: 'Run', noun: 'run', icon: 'run', kind: 'run', quickLog: true, kcalPerMin: 10, defaultMinutes: 30 },
  { type: 'swim', label: 'Swim', noun: 'swim', icon: 'swim', kind: 'swim', quickLog: true, kcalPerMin: 9, defaultMinutes: 30 },
  { type: 'pickleball', label: 'Pickle', noun: 'pickleball', icon: 'pickleball', kind: 'match', quickLog: true, kcalPerMin: 6, defaultMinutes: 90 },
  { type: 'tennis', label: 'Tennis', noun: 'tennis', icon: 'tennis', kind: 'match', quickLog: true, kcalPerMin: 8, defaultMinutes: 90 },
  { type: 'lift', label: 'Lift', noun: 'lift', icon: 'workouts', kind: 'basic', quickLog: false, kcalPerMin: 6, defaultMinutes: 45 },
  { type: 'cycle', label: 'Cycle', noun: 'ride', icon: 'cycle', kind: 'basic', quickLog: false, kcalPerMin: 8, defaultMinutes: 40 },
  { type: 'sport', label: 'Sport', noun: 'sport', icon: 'sport', kind: 'basic', quickLog: false, kcalPerMin: 7, defaultMinutes: 60 },
];

export const QUICK_LOG = ACTIVITIES.filter((a) => a.quickLog);

export const activityMeta = (type: ActivityType) => ACTIVITIES.find((a) => a.type === type) ?? ACTIVITIES[0];

export const estimateKcal = (type: ActivityType, minutes: number) => Math.round(activityMeta(type).kcalPerMin * minutes);

/** "5.2 km", "1,500 m", "3W 2L", "45 min" */
export function lastEntryText(meta: ActivityMeta, last: ActivityLogRow | undefined, units: Units): string {
  if (!last) return 'None yet';
  if (meta.kind === 'run' && last.distance_km != null) return formatDistance(Number(last.distance_km), units);
  if (meta.kind === 'swim' && last.distance_km != null) return formatSwimDistance(Number(last.distance_km), units);
  if (meta.kind === 'match' && last.wins != null && last.losses != null) return `${last.wins}W ${last.losses}L`;
  return `${formatInt(last.duration_min)} min`;
}

// Swim distances read in metres or yards.
const M_PER_YD = 0.9144;
export const swimUnit = (u: Units) => (u === 'imperial' ? 'yd' : 'm');
export const kmToSwim = (km: number, u: Units) => (u === 'imperial' ? (km * 1000) / M_PER_YD : km * 1000);
export const swimToKm = (v: number, u: Units) => (u === 'imperial' ? (v * M_PER_YD) / 1000 : v / 1000);
export const formatSwimDistance = (km: number, u: Units) => `${formatInt(kmToSwim(km, u))} ${swimUnit(u)}`;

// Pace is stored per km; imperial shows it per mile.
const KM_PER_MI = 1.609344;
export const paceUnit = (u: Units) => (u === 'imperial' ? '/mi' : '/km');
export const paceToDisplay = (secPerKm: number, u: Units) => (u === 'imperial' ? secPerKm * KM_PER_MI : secPerKm);
export const paceFromDisplay = (sec: number, u: Units) => (u === 'imperial' ? sec / KM_PER_MI : sec);

/** 330 -> "5:30" */
export const formatPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** "5:30" -> 330, "5" -> 300, "5.5" -> 330 seconds; null when not a pace. */
export function parsePace(text: string): number | null {
  const t = text.trim();
  const mmss = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (mmss) {
    const sec = Number(mmss[2]);
    return sec < 60 ? Number(mmss[1]) * 60 + sec : null;
  }
  const minutes = Number(t);
  return t !== '' && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
}
