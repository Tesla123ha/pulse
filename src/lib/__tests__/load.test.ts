import { describe, expect, it } from 'vitest';
import {
  choiceLabel,
  choiceStep,
  displayToStored,
  formatEffort,
  formatSetLoad,
  resolveChoice,
  setKind,
  storedToDisplay,
  switchValue,
  templateChoice,
} from '../load';

const kgEx = { load_unit: 'kg', target_type: 'reps' } as const;
const plEx = { load_unit: 'stack', target_type: 'reps' } as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

describe('stored values', () => {
  it('round-trips lb to 0.1 precision', () => {
    for (let v = 5; v <= 500; v += 2.5) {
      expect(r1(storedToDisplay(displayToStored(v, 'lb'), 'lb'))).toBe(v);
    }
  });

  it('stores kg with two decimals and no stack level', () => {
    expect(displayToStored(22.5, 'kg')).toEqual({ weight_kg: 22.5, stack_level: null });
    expect(displayToStored(10, 'lb')).toEqual({ weight_kg: 4.54, stack_level: null });
  });

  it('never converts PL and rounds it to 0.5', () => {
    expect(displayToStored(12, 'pl')).toEqual({ weight_kg: 0, stack_level: 12 });
    expect(displayToStored(12.3, 'pl')).toEqual({ weight_kg: 0, stack_level: 12.5 });
    expect(storedToDisplay({ weight_kg: 0, stack_level: 12 }, 'pl')).toBe(12);
  });
});

describe('setKind', () => {
  it('reads the kind from the data, including legacy rows', () => {
    expect(setKind({ weight_kg: 0, stack_level: 10 })).toBe('pl');
    expect(setKind({ weight_kg: 0, stack_level: 0 })).toBe('pl');
    expect(setKind({ weight_kg: 0, stack_level: null })).toBe('mass');
    expect(setKind({ weight_kg: 40, stack_level: null })).toBe('mass');
    expect(setKind({ weight_kg: 40 })).toBe('mass');
  });
});

describe('resolveChoice', () => {
  const pl = { weight_kg: 0, stack_level: 8 };
  const mass = { weight_kg: 20, stack_level: null };
  it('prefers the saved choice', () => {
    expect(resolveChoice(kgEx, 'metric', 'pl', mass)).toBe('pl');
    expect(resolveChoice(plEx, 'imperial', 'kg', pl)).toBe('kg');
  });
  it('then the kind of the latest set', () => {
    expect(resolveChoice(kgEx, 'metric', null, pl)).toBe('pl');
    expect(resolveChoice(plEx, 'imperial', undefined, mass)).toBe('lb');
    expect(resolveChoice(plEx, 'metric', undefined, mass)).toBe('kg');
  });
  it('then the template', () => {
    expect(resolveChoice(plEx, 'metric')).toBe('pl');
    expect(resolveChoice(kgEx, 'imperial')).toBe('lb');
    expect(templateChoice(kgEx, 'metric')).toBe('kg');
  });
});

describe('formatting and switching', () => {
  it('labels and steps', () => {
    expect(['kg', 'lb', 'pl'].map((c) => choiceLabel(c as 'kg'))).toEqual(['KG', 'LB', 'PL']);
    expect([choiceStep('kg'), choiceStep('lb'), choiceStep('pl')]).toEqual([2.5, 5, 1]);
  });
  it('formats a set by its kind', () => {
    expect(formatSetLoad({ weight_kg: 22.5, stack_level: null }, 'kg')).toBe('22.5 kg');
    expect(formatSetLoad({ weight_kg: 22.5, stack_level: null }, 'imperial')).toBe('49.6 lb');
    expect(formatSetLoad({ weight_kg: 0, stack_level: 12 }, 'kg')).toBe('12 PL');
  });
  it('formats effort with a choice', () => {
    expect(formatEffort(12, 8, plEx, 'pl')).toBe('12 PL × 8');
    expect(formatEffort(22.5, 10, kgEx, 'lb')).toBe('49.6 lb × 10');
    expect(formatEffort(0, 15, kgEx, 'kg')).toBe('15 reps');
    expect(formatEffort(22.5, 10, kgEx, 'metric')).toBe('22.5 kg × 10');
  });
  it('switches kg and lb exactly and uses the fallback across PL', () => {
    expect(switchValue(10, 'kg', 'lb', 0)).toBeCloseTo(22.0462, 3);
    expect(switchValue(22.0462, 'lb', 'kg', 0)).toBeCloseTo(10, 3);
    expect(switchValue(10, 'kg', 'pl', 6)).toBe(6);
    expect(switchValue(10, 'pl', 'lb', 40)).toBe(40);
    expect(switchValue(7, 'pl', 'pl', 1)).toBe(7);
  });
});
