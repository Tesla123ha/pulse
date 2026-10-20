import { describe, expect, it } from 'vitest';
import { heatLabel, heatLevel, monthDelta, monthHeatmap, monthPeriod } from '../progress';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const log = (iso: string, duration_min: number) => ({ logged_at: iso, duration_min });
const oct = new Date(2026, 9, 1);
const today = new Date(2026, 9, 20, 9);

describe('heatLevel', () => {
  it('splits at half the goal and at the goal', () => {
    expect(heatLevel(0, 45)).toBe(0);
    expect(heatLevel(1, 45)).toBe(1);
    expect(heatLevel(22, 45)).toBe(1);
    expect(heatLevel(22.5, 45)).toBe(2);
    expect(heatLevel(44, 45)).toBe(2);
    expect(heatLevel(45, 45)).toBe(3);
    expect(heatLevel(90, 45)).toBe(3);
  });
});

describe('monthHeatmap', () => {
  it('has 4 leading blanks and 31 days for October 2026', () => {
    const h = monthHeatmap([], oct, today, 45);
    expect(h.cells.slice(0, 4).every((c) => c === null)).toBe(true);
    expect(h.cells.filter(Boolean)).toHaveLength(31);
    expect(h.cells).toHaveLength(35);
  });

  it('sums a day, counts activities and flags the future', () => {
    const h = monthHeatmap([log(at(2026, 10, 14), 20), log(at(2026, 10, 14, 18), 30), log(at(2026, 9, 30), 99)], oct, today, 45);
    const c = h.cells.find((x) => x?.key === '2026-10-14')!;
    expect(c).toMatchObject({ minutes: 50, count: 2, level: 3, goalMet: true, future: false });
    expect(h.totalMin).toBe(50);
    expect(h.activeDays).toBe(1);
    expect(h.cells.find((x) => x?.key === '2026-10-20')!.future).toBe(false);
    expect(h.cells.find((x) => x?.key === '2026-10-21')!.future).toBe(true);
  });

  it('puts a late-night log on its local day', () => {
    const h = monthHeatmap([log(at(2026, 10, 5, 23, 59), 10), log(at(2026, 10, 6, 0, 0), 10)], oct, today, 45);
    expect(h.cells.find((x) => x?.key === '2026-10-05')!.minutes).toBe(10);
    expect(h.cells.find((x) => x?.key === '2026-10-06')!.minutes).toBe(10);
  });

  it('falls back to the busiest day without a goal', () => {
    const h = monthHeatmap([log(at(2026, 10, 1), 100), log(at(2026, 10, 2), 60), log(at(2026, 10, 3), 20)], oct, today, 0);
    const lv = (k: string) => h.cells.find((x) => x?.key === k)!.level;
    expect([lv('2026-10-01'), lv('2026-10-02'), lv('2026-10-03')]).toEqual([3, 2, 1]);
    expect(h.cells.find((x) => x?.key === '2026-10-01')!.goalMet).toBe(false);
  });
});

describe('heatLabel', () => {
  it('describes days for screen readers', () => {
    const h = monthHeatmap([log(at(2026, 10, 14), 25), log(at(2026, 10, 14, 18), 20), log(at(2026, 10, 15), 10)], oct, today, 45);
    const get = (k: string) => h.cells.find((x) => x?.key === k)!;
    expect(heatLabel(get('2026-10-14')!)).toBe('October 14, 45 min, 2 activities, goal met');
    expect(heatLabel(get('2026-10-15')!)).toBe('October 15, 10 min, 1 activity');
    expect(heatLabel(get('2026-10-16')!)).toBe('October 16, no activity');
  });
});

describe('monthPeriod', () => {
  it('captions with the month, adding the year for other years', () => {
    expect(monthPeriod(oct, today).caption).toBe('in October');
    expect(monthPeriod(new Date(2025, 9, 1), today).caption).toBe('in October 2025');
    expect(monthPeriod(oct, today).end.getMonth()).toBe(10);
  });
});

describe('monthDelta', () => {
  const rows = [
    log(at(2026, 9, 5), 100),
    log(at(2026, 9, 25), 400), // after day 20, ignored in month to date
    log(at(2026, 10, 10), 118),
    log(at(2026, 8, 3), 100),
  ];
  it('compares month to date with the same days of last month', () => {
    expect(monthDelta(rows, oct, today)).toEqual({ text: '+18% vs September', up: true });
  });
  it('compares whole months for past months', () => {
    expect(monthDelta(rows, new Date(2026, 8, 1), today)).toEqual({ text: '+400% vs August', up: true });
    expect(monthDelta(rows, new Date(2026, 7, 1), today)).toBeNull();
  });
  it('reports a drop', () => {
    expect(monthDelta([log(at(2026, 9, 5), 100), log(at(2026, 10, 2), 60)], oct, today)).toEqual({
      text: '−40% vs September',
      up: false,
    });
  });
});
