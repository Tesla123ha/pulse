import { describe, expect, it } from 'vitest';
import { accountBalances, monthTotals } from '../money';

const acc = (id: string, opening: number) => ({ id, opening_balance_centavos: opening });
const rec = (type: 'income' | 'expense' | 'transfer', amount: number, account: string, to: string | null = null) => ({
  type,
  amount_centavos: amount,
  account_id: account,
  to_account_id: to,
});

describe('accountBalances', () => {
  it('starts from the opening balance, including negative', () => {
    const b = accountBalances([acc('a', 5000), acc('c', -2000)], []);
    expect(b.get('a')).toBe(5000);
    expect(b.get('c')).toBe(-2000);
  });

  it('adds income and subtracts expenses', () => {
    const b = accountBalances([acc('a', 1000)], [rec('income', 2500, 'a'), rec('expense', 700, 'a')]);
    expect(b.get('a')).toBe(2800);
  });

  it('moves money out of the source and into the destination on a transfer', () => {
    const b = accountBalances([acc('a', 10000), acc('b', 0)], [rec('transfer', 4000, 'a', 'b')]);
    expect(b.get('a')).toBe(6000);
    expect(b.get('b')).toBe(4000);
  });

  it('ignores records of other accounts', () => {
    const b = accountBalances([acc('a', 100)], [rec('expense', 50, 'x')]);
    expect(b.get('a')).toBe(100);
  });
});

describe('monthTotals', () => {
  it('sums income and expense since the cutoff and skips transfers', () => {
    const r = (type: 'income' | 'expense' | 'transfer', amount: number, at: string) => ({
      type,
      amount_centavos: amount,
      occurred_at: at,
    });
    const t = monthTotals(
      [r('income', 1000, '2026-10-02T00:00:00Z'), r('expense', 300, '2026-10-05T00:00:00Z'), r('transfer', 99, '2026-10-06T00:00:00Z'), r('expense', 800, '2026-09-30T00:00:00Z')],
      new Date('2026-10-01T00:00:00Z'),
    );
    expect(t).toEqual({ spent: 300, income: 1000 });
  });
});
