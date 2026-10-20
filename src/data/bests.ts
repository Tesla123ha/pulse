import type { RecordUnit } from '../lib/database.types';
import { setKind, type SetKind } from '../lib/load';

type Loaded = { weight_kg: number | string; stack_level?: number | string | null };

export interface NewBest {
  kind: SetKind;
  unit: RecordUnit;
  value: number;
}

const valueOf = (s: Loaded) => (setKind(s) === 'pl' ? Number(s.stack_level) : Number(s.weight_kg));

/**
 * Personal bests of one exercise, per kind of set: a PL set is only compared with
 * earlier PL sets, a mass set (stored in kg) only with earlier mass sets. A kind
 * with no earlier sets sets no record, because there is nothing to beat.
 */
export function newBests(current: Loaded[], prior: Loaded[]): NewBest[] {
  const out: NewBest[] = [];
  for (const kind of ['pl', 'mass'] as const) {
    const now = current.filter((s) => setKind(s) === kind).map(valueOf);
    const before = prior.filter((s) => setKind(s) === kind).map(valueOf);
    if (now.length === 0 || before.length === 0) continue;
    const best = Math.max(...now);
    if (best > Math.max(...before) && Math.max(...before) > 0) {
      out.push({ kind, unit: kind === 'pl' ? 'stack' : 'kg', value: best });
    }
  }
  return out;
}
