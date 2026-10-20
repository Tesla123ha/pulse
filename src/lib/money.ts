// Money formatting and parsing. Amounts are whole centavos everywhere.
import type { IconName } from '../components';
import type { AccountKind, MoneyAccountRow, MoneyRecordRow, MoneyRecordType } from './database.types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** 1234550 -> "₱12,345.50" */
export const formatPeso = (centavos: number) => peso.format(centavos / 100);

/** Signed for records: "−₱250.00", "+₱20,000.00", plain for transfers. */
export function formatRecordAmount(type: MoneyRecordType, centavos: number): string {
  if (type === 'transfer') return formatPeso(centavos);
  return `${type === 'expense' ? '−' : '+'}${formatPeso(centavos)}`;
}

/** "1,250.50" -> 125050; null when it is not a positive amount with at most two decimals. */
export function parsePesoInput(text: string): number | null {
  const t = text.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const centavos = Math.round(Number(t) * 100);
  return Number.isFinite(centavos) ? centavos : null;
}

/** Like parsePesoInput but allows a leading minus, for opening balances (a card can start in debt). */
export function parseSignedPesoInput(text: string): number | null {
  const t = text.trim();
  const negative = t.startsWith('-') || t.startsWith('−');
  const v = parsePesoInput(negative ? t.slice(1) : t);
  return v === null ? null : negative ? -v : v;
}

/** 125050 -> "1250.50" for editing */
export const centavosToInput = (centavos: number) => (centavos / 100).toFixed(2).replace(/\.00$/, '');

export const ACCOUNT_KINDS: { kind: AccountKind; label: string; icon: IconName }[] = [
  { kind: 'cash', label: 'Cash', icon: 'cash' },
  { kind: 'bank', label: 'Bank', icon: 'bank' },
  { kind: 'ewallet', label: 'E-wallet', icon: 'wallet' },
  { kind: 'card', label: 'Card', icon: 'card' },
  { kind: 'savings', label: 'Savings', icon: 'savings' },
  { kind: 'other', label: 'Other', icon: 'dots' },
];

export const accountKind = (kind: AccountKind) => ACCOUNT_KINDS.find((k) => k.kind === kind) ?? ACCOUNT_KINDS[5];

const CATEGORY_ICONS: IconName[] = ['food', 'car', 'receipt', 'bag', 'heart', 'ticket', 'home', 'dots', 'briefcase', 'store', 'gift'];
export const categoryIcon = (name: string): IconName =>
  (CATEGORY_ICONS as string[]).includes(name) ? (name as IconName) : 'dots';

type BalanceAccount = Pick<MoneyAccountRow, 'id' | 'opening_balance_centavos'>;
type BalanceRecord = Pick<MoneyRecordRow, 'type' | 'amount_centavos' | 'account_id' | 'to_account_id'>;

/**
 * Balance per account id, in whole centavos: the opening balance plus income,
 * minus expenses, minus transfers out, plus transfers in. This is the
 * money_account_balances view (supabase/migrations/0005_money.sql) in JS.
 */
export function accountBalances(accounts: BalanceAccount[], records: BalanceRecord[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of accounts) out.set(a.id, Number(a.opening_balance_centavos));
  const add = (id: string | null, delta: number) => {
    if (id !== null && out.has(id)) out.set(id, (out.get(id) as number) + delta);
  };
  for (const r of records) {
    const amount = Number(r.amount_centavos);
    if (r.type === 'income') add(r.account_id, amount);
    else if (r.type === 'expense') add(r.account_id, -amount);
    else {
      add(r.account_id, -amount);
      add(r.to_account_id, amount);
    }
  }
  return out;
}

/** Expense and income totals for records at or after `since` (transfers excluded). */
export function monthTotals(records: Pick<MoneyRecordRow, 'type' | 'amount_centavos' | 'occurred_at'>[], since: Date) {
  const from = since.getTime();
  let spent = 0;
  let income = 0;
  for (const r of records) {
    if (new Date(r.occurred_at).getTime() < from) continue;
    if (r.type === 'expense') spent += Number(r.amount_centavos);
    else if (r.type === 'income') income += Number(r.amount_centavos);
  }
  return { spent, income };
}
