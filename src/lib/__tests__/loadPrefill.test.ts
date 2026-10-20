import { describe, expect, it } from 'vitest';
import { formatSetEffort, seedLoad, switchedLoad, weightIrrelevant } from '../loadPrefill';

const kgEx = { load_unit: 'kg', target_type: 'reps', start_load: 20 } as const;
const plEx = {
  load_unit: 'stack',
  target_type: 'reps',
  start_load: 12,
} as const;
const mass = (kg: number) => ({ weight_kg: kg, stack_level: null });
const pl = (n: number) => ({ weight_kg: 0, stack_level: n });

describe('seedLoad', () => {
  it('uses the first set of the same kind', () => {
    expect(seedLoad(kgEx, 'kg', [pl(8), mass(25), mass(30)])).toBe(25);
    expect(seedLoad(kgEx, 'pl', [mass(25), pl(8)])).toBe(8);
  });
  it('shows lb to 0.1', () => {
    expect(seedLoad(kgEx, 'lb', [mass(25)])).toBe(55.1);
  });
  it('falls back to the template when its kind matches', () => {
    expect(seedLoad(kgEx, 'kg', [pl(8)])).toBe(20);
    expect(seedLoad(kgEx, 'lb', [])).toBe(44.1);
    expect(seedLoad(plEx, 'pl', [mass(25)])).toBe(12);
  });
  it('is 0 when nothing of that kind exists', () => {
    expect(seedLoad(kgEx, 'pl', [mass(25)])).toBe(0);
    expect(seedLoad(plEx, 'kg', [])).toBe(0);
  });
  it('rounds PL to 0.5', () => {
    expect(seedLoad(plEx, 'pl', [pl(7.25)])).toBe(7.5);
  });
});

describe('switchedLoad', () => {
  it('converts kg and lb without snapping to the step', () => {
    expect(switchedLoad(22.5, 'kg', 'lb', 0)).toBe(49.6);
    expect(switchedLoad(50, 'lb', 'kg', 0)).toBe(22.7);
  });
  it('uses the fallback to or from PL', () => {
    expect(switchedLoad(22.5, 'kg', 'pl', 8)).toBe(8);
    expect(switchedLoad(8, 'pl', 'lb', 44.1)).toBe(44.1);
  });
});

describe('weightIrrelevant', () => {
  const plank = {
    load_unit: 'kg',
    target_type: 'seconds',
    start_load: 0,
  } as const;
  it('hides weight for unloaded holds and max-rep moves', () => {
    expect(weightIrrelevant(plank, [])).toBe(true);
    expect(weightIrrelevant({ ...plank, target_type: 'max', start_load: null }, [mass(0)])).toBe(true);
  });
  it('keeps it once a load was logged or templated', () => {
    expect(weightIrrelevant(plank, [mass(5)])).toBe(false);
    expect(weightIrrelevant(plank, [pl(2)])).toBe(false);
    expect(weightIrrelevant({ ...plank, start_load: 5 }, [])).toBe(false);
    expect(weightIrrelevant(kgEx, [])).toBe(false);
  });
});

describe('formatSetEffort', () => {
  const row = (w: number, st: number | null, reps: number) =>
    ({ weight_kg: w, stack_level: st, reps }) as Parameters<typeof formatSetEffort>[0];
  it('shows a PL set in PL whatever the choice', () => {
    expect(formatSetEffort(row(0, 12, 8), kgEx, 'kg', 'metric')).toBe('12 PL × 8');
  });
  it('shows a mass set in the choice, or profile units while on PL', () => {
    expect(formatSetEffort(row(25, null, 10), kgEx, 'lb', 'metric')).toBe('55.1 lb × 10');
    expect(formatSetEffort(row(25, null, 10), kgEx, 'pl', 'metric')).toBe('25 kg × 10');
  });
});
