import { addDays, startOfDay } from '../lib/dates';
import type {
  AccountKind,
  MoneyAccountRow,
  MoneyCategoryRow,
  MoneyRecordRow,
  MoneyRecordType,
} from '../lib/database.types';
import { accountBalances, monthTotals } from '../lib/money';
import { getDb } from '../offline/db';
import { inflightSeqs, localWrite } from '../offline/outbox';
import { newAccountRow, newRecordRow } from '../offline/rows';

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
  const since = addDays(startOfDay(now), -90).getTime();
  const db = getDb();
  const [accounts, categories, records] = await Promise.all([
    db.money_accounts.toArray(),
    db.money_categories.toArray(),
    db.money_records.toArray(),
  ]);
  const byCreated = (a: { created_at: string }, b: { created_at: string }) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  accounts.sort((a, b) => a.sort_order - b.sort_order || byCreated(a, b));
  categories.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.sort_order - b.sort_order));

  const balanceOf = accountBalances(accounts, records);
  const withBalances = accounts.map((a) => ({ ...a, balanceCentavos: balanceOf.get(a.id) ?? 0 }));
  const month = monthTotals(records, monthStart);
  const at = (r: MoneyRecordRow) => new Date(r.occurred_at).getTime();
  return {
    accounts: withBalances,
    categories,
    recent: records
      .filter((r) => at(r) >= since)
      .sort((a, b) => at(b) - at(a))
      .slice(0, 500),
    totalCentavos: withBalances.reduce((s, a) => s + a.balanceCentavos, 0),
    monthSpentCentavos: month.spent,
    monthIncomeCentavos: month.income,
  };
}

export interface AccountInput {
  name: string;
  kind: AccountKind;
  openingBalanceCentavos: number;
}

export async function saveAccount(userId: string, input: AccountInput, id?: string): Promise<void> {
  const fields = {
    name: input.name.trim(),
    kind: input.kind,
    opening_balance_centavos: input.openingBalanceCentavos,
  };
  const db = getDb();
  await localWrite(db, ['money_accounts'], async (w) => {
    if (id) {
      if (!(await db.money_accounts.get(id))) throw new Error('This account no longer exists.');
      await w.update('money_accounts', id, fields);
    } else {
      await w.upsert('money_accounts', newAccountRow({ user_id: userId, currency: 'PHP', ...fields }));
    }
  });
}

/**
 * Deletes the account and every record that uses it, including transfers.
 * Only the account delete is queued: the server cascades to its records, and
 * their own pending writes are dropped so they cannot fail on the missing account.
 */
export async function deleteAccount(id: string): Promise<void> {
  const db = getDb();
  await localWrite(db, ['money_accounts', 'money_records'], async (w) => {
    const records = await db.money_records.filter((r) => r.account_id === id || r.to_account_id === id).toArray();
    const keys = new Set(records.map((r) => r.id));
    await db.money_records.bulkDelete([...keys]);
    const ops = await db.outbox
      .where('table')
      .equals('money_records')
      .filter((o) => keys.has(o.rowKey) && (o.seq === undefined || !inflightSeqs.has(o.seq)))
      .toArray();
    await db.outbox.bulkDelete(ops.map((o) => o.seq as number));
    await w.remove('money_accounts', id);
  });
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
  const fields = {
    type: input.type,
    amount_centavos: input.amountCentavos,
    account_id: input.accountId,
    to_account_id: transfer ? input.toAccountId : null,
    category_id: transfer ? null : input.categoryId,
    note: input.note.trim() || null,
    occurred_at: input.occurredAt,
  };
  const db = getDb();
  await localWrite(db, ['money_records'], async (w) => {
    // Mirrors the database's composite keys: a record only uses its owner's accounts.
    const own = async (accountId: string) => (await db.money_accounts.get(accountId))?.user_id === userId;
    if (!(await own(fields.account_id))) throw new Error('That account is not available.');
    if (transfer) {
      if (!fields.to_account_id || fields.to_account_id === fields.account_id || !(await own(fields.to_account_id))) {
        throw new Error('Pick two different accounts for a transfer.');
      }
    }
    if (id) {
      if (!(await db.money_records.get(id))) throw new Error('This record no longer exists.');
      await w.update('money_records', id, fields);
    } else {
      await w.upsert('money_records', newRecordRow({ user_id: userId, ...fields }));
    }
  });
}

export async function deleteRecord(id: string): Promise<void> {
  await localWrite(getDb(), ['money_records'], (w) => w.remove('money_records', id));
}
