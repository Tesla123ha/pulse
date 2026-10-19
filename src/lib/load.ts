// Exercise load: kilograms (converted for display) or machine stack level (PL).
import type { SetLogRow, Units, WorkoutExerciseRow } from './database.types';
import { formatDecimal } from './format';
import { displayToKg, formatWeight, kgToDisplay, weightUnit } from './units';

type Ex = Pick<WorkoutExerciseRow, 'load_unit' | 'target_type'>;

export const isStack = (ex: Ex) => ex.load_unit === 'stack';

/** Stepper label unit: "kg", "lb" or "PL". */
export const loadUnitLabel = (ex: Ex, units: Units) => (isStack(ex) ? 'PL' : weightUnit(units));

/** Stepper increment in display units. */
export const loadStep = (ex: Ex, units: Units) => (isStack(ex) ? 1 : units === 'imperial' ? 5 : 2.5);

/** A set's load as stored: kg, or stack level. */
export const storedLoad = (s: Pick<SetLogRow, 'weight_kg' | 'stack_level'>, ex: Ex) =>
  isStack(ex) ? Number(s.stack_level ?? 0) : Number(s.weight_kg);

export const toDisplayLoad = (stored: number, ex: Ex, units: Units) =>
  isStack(ex) ? stored : kgToDisplay(stored, units);

export const fromDisplayLoad = (value: number, ex: Ex, units: Units) =>
  isStack(ex) ? value : displayToKg(value, units);

/** "12 PL", "22.5 kg" */
export const formatLoad = (stored: number, ex: Ex, units: Units) =>
  isStack(ex) ? `${formatDecimal(stored)} PL` : formatWeight(stored, units);

/** "12 PL × 8", "22.5 kg × 10", "15 reps" (bodyweight), "30 s" (hold) */
export function formatEffort(load: number, reps: number, ex: Ex, units: Units): string {
  const effort = ex.target_type === 'seconds' ? `${reps} s` : `${reps}`;
  if (load <= 0) return ex.target_type === 'seconds' ? effort : `${reps} reps`;
  return ex.target_type === 'seconds' ? `${formatLoad(load, ex, units)} · ${effort}` : `${formatLoad(load, ex, units)} × ${effort}`;
}

export const formatSet = (s: SetLogRow, ex: Ex, units: Units) => formatEffort(storedLoad(s, ex), s.reps, ex, units);
