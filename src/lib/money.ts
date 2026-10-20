// Money formatting and parsing. Amounts are whole centavos everywhere.
import type { IconName } from '../components';
import type { AccountKind, MoneyRecordType } from './database.types';

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
