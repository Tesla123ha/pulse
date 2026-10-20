// Which weight a set starts from, and how it follows a change of unit.
import type { SetLogRow, Units, WorkoutExerciseRow } from './database.types';
import {
  formatEffort,
  setKind,
  storedToDisplay,
  switchValue,
  unitsChoice,
  type LoadChoice,
  type SetKind,
} from './load';

type Ex = Pick<WorkoutExerciseRow, 'load_unit' | 'target_type' | 'start_load'>;
type LoadFields = Pick<SetLogRow, 'weight_kg' | 'stack_level'>;

export const choiceKind = (c: LoadChoice): SetKind => (c === 'pl' ? 'pl' : 'mass');

/** Mass shows to 0.1, plate levels to 0.5. */
export const roundForChoice = (v: number, c: LoadChoice) =>
  c === 'pl' ? Math.round(v * 2) / 2 : Math.round(v * 10) / 10;

/**
 * The weight to start from, in the choice's unit: the first candidate set of the
 * same kind (most preferred first), else the template's start load when it is of
 * that kind, else 0.
 */
export function seedLoad(ex: Ex, choice: LoadChoice, candidates: readonly LoadFields[]): number {
  const kind = choiceKind(choice);
  const match = candidates.find((s) => setKind(s) === kind);
  if (match) return roundForChoice(storedToDisplay(match, choice), choice);
  const start = Number(ex.start_load ?? 0);
  const templateKind: SetKind = ex.load_unit === 'stack' ? 'pl' : 'mass';
  if (start > 0 && templateKind === kind) {
    return roundForChoice(choice === 'lb' ? switchValue(start, 'kg', 'lb', 0) : start, choice);
  }
  return 0;
}

/** The value after changing unit: kg and lb convert, PL and mass re-seed from `fallback`. */
export const switchedLoad = (value: number, from: LoadChoice, to: LoadChoice, fallback: number) =>
  roundForChoice(switchValue(value, from, to, fallback), to);

/**
 * True when weight does not apply: a timed hold or max-reps exercise with no
 * template load and nothing ever logged with a load (Plank, Russian Twists).
 */
export function weightIrrelevant(ex: Ex, sets: readonly LoadFields[]): boolean {
  if (ex.target_type !== 'seconds' && ex.target_type !== 'max') return false;
  if (Number(ex.start_load ?? 0) > 0) return false;
  return !sets.some((s) => Number(s.weight_kg) > 0 || Number(s.stack_level ?? 0) > 0);
}

/**
 * "12 PL × 8", "22.5 kg × 10": a logged set in its OWN kind. A PL set always reads
 * in PL; a mass set reads in the exercise's kg or lb choice (profile units while it is PL).
 */
export function formatSetEffort(s: SetLogRow, ex: Ex, choice: LoadChoice, units: Units): string {
  if (setKind(s) === 'pl') return formatEffort(Number(s.stack_level), s.reps, ex, 'pl');
  return formatEffort(Number(s.weight_kg), s.reps, ex, choice === 'pl' ? unitsChoice(units) : choice);
}
