import { supabase } from '../lib/supabase';
import { addDays, startOfDay } from '../lib/dates';
import type {
  AccountKind,
  MoneyAccountRow,
  MoneyCategoryRow,
  MoneyRecordRow,
  MoneyRecordType,
} from '../lib/database.types';
import { maybe, must } from './useLoader';

export interface MoneyAccount extends MoneyAccountRow {
  balanceCentavos: number;
}

export interface MoneyData {
  accounts: MoneyAccount[];
  categories: MoneyCategoryRow[];
  /** Records from the last 90 days, newest first. */
  recent: MoneyRecordRow[];
  totalCentavos: number;
  /** This calendar month. */
  monthSpentCentavos: number;
  monthIncomeCentavos: number;
}

export async function loadMoney(): Promise<MoneyData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = addDays(startOfDay(now), -90);
  const [accounts, balances, categories, recent, month] = await Promise.all([
    supabase.from('money_accounts').select('*').order('sort_order').order('created_at').then(must),
    supabase.from('money_account_balances').select('*').then(must),
    supabase.from('money_categories').select('*').order('kind').order('sort_order').then(must),
    supabase
      .from('money_records')
      .select('*')
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(500)
      .then(must),
    supabase
      .from('money_records')
      .select('type, amount_centavos')
      .in('type', ['expense', 'income'])
      .gte('occurred_at', monthStart.toISOString())
      .then(must),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.account_id, Number(b.balance_centavos)]));
  const withBalances = accounts.map((a) => ({ ...a, balanceCentavos: balanceOf.get(a.id) ?? Number(a.opening_balance_centavos) }));
  const sum = (type: MoneyRecordType) =>
    month.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount_centavos), 0);
  return {
    accounts: withBalances,
    categories,
    recent: recent.map((r) => ({ ...r, amount_centavos: Number(r.amount_centavos) })),
    totalCentavos: withBalances.reduce((s, a) => s + a.balanceCentavos, 0),
    monthSpentCentavos: sum('expense'),
    monthIncomeCentavos: sum('income'),
  };
}

export interface AccountInput {
  name: string;
  kind: AccountKind;
  openingBalanceCentavos: number;
}

export async function saveAccount(userId: string, input: AccountInput, id?: string): Promise<void> {
  const row = {
    name: input.name.trim(),
    kind: input.kind,
    opening_balance_centavos: input.openingBalanceCentavos,
  };
  if (id) must(await supabase.from('money_accounts').update(row).eq('id', id).select('id'));
  else must(await supabase.from('money_accounts').insert({ ...row, user_id: userId, currency: 'PHP' }).select('id'));
}

/** Deletes the account and every record that uses it, including transfers. */
export async function deleteAccount(id: string): Promise<void> {
  must(await supabase.from('money_accounts').delete().eq('id', id).select('id'));
}

export interface RecordInput {
  type: MoneyRecordType;
  amountCentavos: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  occurredAt: string;
}

export async function saveRecord(userId: string, input: RecordInput, id?: string): Promise<void> {
  const transfer = input.type === 'transfer';
  const row = {
    type: input.type,
    amount_centavos: input.amountCentavos,
    account_id: input.accountId,
    to_account_id: transfer ? input.toAccountId : null,
    category_id: transfer ? null : input.categoryId,
    note: input.note.trim() || null,
    occurred_at: input.occurredAt,
  };
  if (id) must(await supabase.from('money_records').update(row).eq('id', id).select('id'));
  else must(await supabase.from('money_records').insert({ ...row, user_id: userId }).select('id'));
}

export async function deleteRecord(id: string): Promise<void> {
  maybe(await supabase.from('money_records').delete().eq('id', id));
}
