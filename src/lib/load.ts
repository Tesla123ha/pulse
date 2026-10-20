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

/**
 * "12 PL × 8", "22.5 kg × 10", "15 reps" (bodyweight), "30 s" (hold).
 * `load` is a stored value (kg, or PL). The last argument is the profile units
 * (the exercise decides kg/lb vs PL) or an explicit per-exercise choice.
 */
export function formatEffort(load: number, reps: number, ex: Ex, unitsOrChoice: Units | LoadChoice): string {
  const effort = ex.target_type === 'seconds' ? `${reps} s` : `${reps}`;
  if (load <= 0) return ex.target_type === 'seconds' ? effort : `${reps} reps`;
  const text = isChoice(unitsOrChoice) ? formatChoiceLoad(load, unitsOrChoice) : formatLoad(load, ex, unitsOrChoice);
  return ex.target_type === 'seconds' ? `${text} · ${effort}` : `${text} × ${effort}`;
}

export const formatSet = (s: SetLogRow, ex: Ex, units: Units) => formatEffort(storedLoad(s, ex), s.reps, ex, units);

// ---------------------------------------------------------------------------
// Per-exercise weight unit: kg, lb or PL (plate level).
// A set's KIND comes from the data: stack_level set means a PL set, anything
// else is a mass set stored in kg. kg vs lb is only a display choice.
// ---------------------------------------------------------------------------

export type LoadChoice = 'kg' | 'lb' | 'pl';
export const LOAD_CHOICES: readonly LoadChoice[] = ['kg', 'lb', 'pl'];
export type SetKind = 'pl' | 'mass';

/** What the set stores: kg for mass sets, or a stack level for PL sets. */
export interface StoredLoad {
  weight_kg: number;
  stack_level: number | null;
}

type SetLoadFields = { weight_kg: number | string; stack_level?: number | string | null };

export const isChoice = (v: unknown): v is LoadChoice => v === 'kg' || v === 'lb' || v === 'pl';

/** Segmented-control label: "KG", "LB", "PL". */
export const choiceLabel = (c: LoadChoice) => c.toUpperCase();

/** Unit as written in text: "kg", "lb", "PL". */
export const choiceText = (c: LoadChoice) => (c === 'pl' ? 'PL' : c);

/** "22.5 kg", "12 PL" from a value already in the choice's own unit. */
export const formatChoiceValue = (value: number, c: LoadChoice) => `${formatDecimal(value)} ${choiceText(c)}`;

/** "22.5 kg", "49.6 lb", "12 PL" from a stored value (kg, or PL) shown in the choice. */
export const formatChoiceLoad = (stored: number, c: LoadChoice) =>
  formatChoiceValue(c === 'lb' ? kgToDisplay(stored, 'imperial') : stored, c);

/** PL for stack_level sets (even level 0); everything else, including legacy 0 kg rows, is mass. */
export const setKind = (s: SetLoadFields): SetKind => (s.stack_level === null || s.stack_level === undefined ? 'mass' : 'pl');

export const unitsChoice = (units: Units): LoadChoice => (units === 'imperial' ? 'lb' : 'kg');

/** The unit an exercise starts with: PL for stack exercises, otherwise the profile units. */
export const templateChoice = (ex: Pick<WorkoutExerciseRow, 'load_unit'>, units: Units): LoadChoice =>
  ex.load_unit === 'stack' ? 'pl' : unitsChoice(units);

/** Saved choice, else the kind of the latest set, else the template's unit. */
export function resolveChoice(
  ex: Pick<WorkoutExerciseRow, 'load_unit'>,
  units: Units,
  pref?: LoadChoice | null,
  latestSet?: SetLoadFields | null,
): LoadChoice {
  if (pref) return pref;
  if (latestSet) return setKind(latestSet) === 'pl' ? 'pl' : unitsChoice(units);
  return templateChoice(ex, units);
}

/** Stepper increment in the choice's unit. */
export const choiceStep = (c: LoadChoice) => (c === 'kg' ? 2.5 : c === 'lb' ? 5 : 1);

/** A set's value in the choice's unit, unrounded. A set of the other kind has none, so 0. */
export function storedToDisplay(s: SetLoadFields, c: LoadChoice): number {
  if (c === 'pl') return setKind(s) === 'pl' ? Number(s.stack_level) : 0;
  if (setKind(s) === 'pl') return 0;
  return c === 'lb' ? kgToDisplay(Number(s.weight_kg), 'imperial') : Number(s.weight_kg);
}

/** What to store for a value typed in the choice's unit. PL is never converted. */
export function displayToStored(value: number, c: LoadChoice): StoredLoad {
  if (c === 'pl') return { weight_kg: 0, stack_level: Math.round(value * 2) / 2 };
  const kg = c === 'lb' ? displayToKg(value, 'imperial') : value;
  return { weight_kg: Math.round(kg * 100) / 100, stack_level: null };
}

/** A set's load as text in its own kind: "12 PL", or kg/lb per the choice (profile units for a bare Units). */
export function formatSetLoad(s: SetLoadFields, choiceOrUnits: LoadChoice | Units): string {
  if (setKind(s) === 'pl') return formatChoiceValue(Number(s.stack_level), 'pl');
  const c = isChoice(choiceOrUnits) ? choiceOrUnits : unitsChoice(choiceOrUnits);
  return formatChoiceLoad(Number(s.weight_kg), c === 'pl' ? 'kg' : c);
}

/** The number to show after switching units. kg and lb convert; changing to or from PL cannot, so `fallback`. */
export function switchValue(value: number, from: LoadChoice, to: LoadChoice, fallback: number): number {
  if (from === to) return value;
  if (from === 'pl' || to === 'pl') return fallback;
  return from === 'kg' ? kgToDisplay(value, 'imperial') : displayToKg(value, 'imperial');
}

