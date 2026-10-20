// Pure Progress calculations over activity logs, sessions and records.
import type { ActivityLogRow, PersonalRecordRow, Units } from './database.types';
import { activityMeta, formatPace, formatSwimDistance } from './activity';
import { addDays, dateKey, startOfDay } from './dates';
import { formatDecimal, formatInt } from './format';
import { formatClock } from './session';
import { formatDistance, formatWeight } from './units';
import type { ChartBar } from '../components/ChartBars';

export const RANGES = ['Week', 'Month', 'Year'] as const;
export type Range = (typeof RANGES)[number];

type Act = Pick<ActivityLogRow, 'logged_at' | 'duration_min' | 'kcal' | 'distance_km' | 'type' | 'wins' | 'losses'>;

interface Bucket {
  start: Date;
  end: Date; // exclusive
  label: string;
  name: string;
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' });
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' });

/** Chart buckets for a range, oldest first; the last bucket is the current period. */
export function buckets(range: Range, now: Date): Bucket[] {
  const today = startOfDay(now);
  if (range === 'Week') {
    return Array.from({ length: 7 }, (_, i) => {
      const start = addDays(today, i - 6);
      const name = WEEKDAY.format(start);
      return { start, end: addDays(start, 1), label: name.charAt(0), name };
    });
  }
  if (range === 'Month') {
    // Four rolling weeks ending today.
    return Array.from({ length: 4 }, (_, i) => {
      const end = addDays(today, 1 - (3 - i) * 7);
      const start = addDays(end, -7);
      return { start, end, label: DAY.format(start), name: `week of ${DAY.format(start)}` };
    });
  }
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end, label: MONTH.format(start).charAt(0), name: MONTH_LONG.format(start) };
  });
}

const inRange = (a: Pick<ActivityLogRow, 'logged_at'>, start: Date, end: Date) => {
  const t = new Date(a.logged_at).getTime();
  return t >= start.getTime() && t < end.getTime();
};

/** "5h 11m", "38m" */
export const formatMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const PREVIOUS: Record<Range, string> = { Week: 'last week', Month: 'the previous 4 weeks', Year: 'the previous year' };

export interface ActiveTime {
  bars: ChartBar[];
  totalMin: number;
  /** "+18% vs last week"; null when there is nothing to compare with. */
  delta: { text: string; up: boolean } | null;
  /** Goal for one bar, in minutes; null for the year view. */
  goalMin: number | null;
  /** Period of the whole chart. */
  start: Date;
  end: Date;
}

export function activeTime(activity: Act[], range: Range, now: Date, dailyGoalMin: number): ActiveTime {
  const bs = buckets(range, now);
  const start = bs[0].start;
  const end = bs[bs.length - 1].end;
  const bars = bs.map((b) => ({
    label: b.label,
    name: b.name,
    value: activity.filter((a) => inRange(a, b.start, b.end)).reduce((s, a) => s + a.duration_min, 0),
  }));
  const totalMin = bars.reduce((s, b) => s + b.value, 0);
  // Same-length period immediately before.
  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span);
  const prevMin = activity.filter((a) => inRange(a, prevStart, start)).reduce((s, a) => s + a.duration_min, 0);
  let delta: ActiveTime['delta'] = null;
  if (prevMin > 0) {
    const pct = Math.round(((totalMin - prevMin) / prevMin) * 100);
    delta = { text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}% vs ${PREVIOUS[range]}`, up: pct >= 0 };
  }
  const goalMin = range === 'Week' ? dailyGoalMin : range === 'Month' ? dailyGoalMin * 7 : null;
  return { bars, totalMin, delta, goalMin, start, end };
}

/** Longest run of consecutive active days, all time. */
export function longestStreak(activity: Pick<ActivityLogRow, 'logged_at'>[]): number {
  const days = [...new Set(activity.map((a) => dateKey(new Date(a.logged_at))))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    run = prev && dateKey(addDays(prev, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

export interface MatchRecord {
  type: 'pickleball' | 'tennis';
  label: string;
  wins: number;
  losses: number;
  sessions: number;
  /** 0 to 100, one decimal; null with no games. */
  winRate: number | null;
}

/** Won and lost games per racket sport within the activities given. */
export function matchRecords(activity: Act[]): MatchRecord[] {
  return (['pickleball', 'tennis'] as const)
    .map((type) => {
      const rows = activity.filter((a) => a.type === type);
      const wins = rows.reduce((s, a) => s + (a.wins ?? 0), 0);
      const losses = rows.reduce((s, a) => s + (a.losses ?? 0), 0);
      const games = wins + losses;
      return {
        type,
        label: type === 'pickleball' ? 'Pickleball' : 'Tennis',
        wins,
        losses,
        sessions: rows.length,
        winRate: games > 0 ? Math.round((wins / games) * 1000) / 10 : null,
      };
    })
    .filter((r) => r.sessions > 0);
}

export interface RecordRow {
  id: string;
  name: string;
  value: string;
  caption: string;
}

const formatRecordValue = (r: Pick<PersonalRecordRow, 'value' | 'unit'>, units: Units) => {
  const v = Number(r.value);
  if (r.unit === 'kg') return formatWeight(v, units);
  if (r.unit === 'stack') return `${formatDecimal(v)} PL`;
  if (r.unit === 'seconds') return formatClock(Math.round(v));
  return formatDistance(v, units);
};

/** Latest record per name, newest first, with the change from the previous record of that name. */
export function recordRows(records: PersonalRecordRow[], units: Units): RecordRow[] {
  const byName = new Map<string, PersonalRecordRow[]>();
  for (const r of [...records].sort((a, b) => b.achieved_on.localeCompare(a.achieved_on))) {
    byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  }
  return [...byName.values()].map(([latest, previous]) => {
    const [y, m, d] = latest.achieved_on.split('-').map(Number);
    const parts = [`Set ${DAY.format(new Date(y, m - 1, d))}`];
    if (previous && previous.unit === latest.unit) {
      const diff = Number(latest.value) - Number(previous.value);
      if (latest.unit === 'seconds') parts.push(`${formatClock(Math.abs(Math.round(diff)))} faster`);
      else if (diff !== 0) parts.push(`+${formatRecordValue({ value: Math.abs(diff), unit: latest.unit }, units)}`);
    }
    return { id: latest.id, name: latest.name, value: formatRecordValue(latest, units), caption: parts.join(' · ') };
  });
}

/** One line describing an activity: "5.2 km · 5:30 /km · 29 min" */
export function activityDetail(
  a: Pick<ActivityLogRow, 'type' | 'duration_min' | 'distance_km' | 'pace_sec_per_km' | 'venue' | 'match_type' | 'wins' | 'losses' | 'kcal'>,
  units: Units,
): string {
  const parts: string[] = [];
  const meta = activityMeta(a.type);
  if (meta.kind === 'run' && a.distance_km != null) {
    parts.push(formatDistance(Number(a.distance_km), units));
    if (a.pace_sec_per_km) parts.push(`${formatPace(a.pace_sec_per_km)} /km`);
  }
  if (meta.kind === 'swim') {
    if (a.distance_km != null) parts.push(formatSwimDistance(Number(a.distance_km), units));
    if (a.venue) parts.push(a.venue === 'pool' ? 'Pool' : 'Open water');
  }
  if (meta.kind === 'match') {
    if (a.match_type) parts.push(a.match_type === 'singles' ? 'Singles' : 'Doubles');
    if (a.wins != null && a.losses != null) parts.push(`${a.wins}W ${a.losses}L`);
  }
  parts.push(`${formatInt(a.duration_min)} min`);
  return parts.join(' · ');
}

/** Activities in [start, end). */
export const between = <T extends Pick<ActivityLogRow, 'logged_at'>>(rows: T[], start: Date, end: Date) =>
  rows.filter((a) => inRange(a, start, end));

/** Title for an activity in lists and confirmations: the workout name, or "Run", "Pickleball". */
export function activityTitle(a: Pick<ActivityLogRow, 'type'> & { workoutName?: string | null }): string {
  const noun = activityMeta(a.type).noun;
  return a.workoutName ?? noun.charAt(0).toUpperCase() + noun.slice(1);
}
