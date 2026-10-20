import type {
  ActivityLogRow,
  MoneyAccountRow,
  MoneyRecordRow,
  PersonalRecordRow,
  PlanWorkoutRow,
  ProfileRow,
  SetLogRow,
  UserAchievementRow,
  WorkoutSessionRow,
} from '../lib/database.types';
import type { PulseDB } from './db';
import { newId } from './ids';
import { requestSync } from './sync';

/** Tables the app writes to; the rest are read-only on the device. */
export type SyncTable =
  | 'profiles'
  | 'workout_sessions'
  | 'set_logs'
  | 'activity_logs'
  | 'plan_workouts'
  | 'personal_records'
  | 'user_achievements'
  | 'money_accounts'
  | 'money_records';

export interface SyncRows {
  profiles: ProfileRow;
  workout_sessions: WorkoutSessionRow;
  set_logs: SetLogRow;
  activity_logs: ActivityLogRow;
  plan_workouts: PlanWorkoutRow;
  personal_records: PersonalRecordRow;
  user_achievements: UserAchievementRow;
  money_accounts: MoneyAccountRow;
  money_records: MoneyRecordRow;
}

export type OutboxKind = 'upsert' | 'update' | 'delete' | 'updateWhere';

/** One local write waiting to be pushed to Supabase. */
export interface OutboxOp {
  seq?: number;
  opId: string;
  table: SyncTable;
  kind: OutboxKind;
  /** Primary key as text; `user_id:achievement_id` for user_achievements. */
  rowKey: string;
  row?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  match?: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
}

/** Sequence numbers of ops being pushed right now; these must not be coalesced. */
export const inflightSeqs = new Set<number>();

export const DATA_CHANGED = 'pulse:data-changed';

export function rowKeyOf(table: SyncTable, row: Record<string, unknown>): string {
  return table === 'user_achievements' ? `${row.user_id}:${row.achievement_id}` : String(row.id);
}

/** Local writes made inside one `localWrite` transaction. */
export interface LocalWriter {
  /** Insert or replace a full row. */
  upsert<T extends SyncTable>(table: T, row: SyncRows[T]): Promise<void>;
  /** Patch the row with this id. */
  update<T extends SyncTable>(table: T, id: string, patch: Partial<SyncRows[T]>): Promise<void>;
  /** Delete the row with this id. */
  remove(table: SyncTable, id: string): Promise<void>;
  /** Patch every row whose columns equal `match`. */
  updateWhere<T extends SyncTable>(table: T, match: Partial<SyncRows[T]>, patch: Partial<SyncRows[T]>): Promise<void>;
}

const canCoalesce = (o: OutboxOp) => o.status === 'pending' && (o.seq === undefined || !inflightSeqs.has(o.seq));

function makeWriter(db: PulseDB): LocalWriter {
  const add = (op: Pick<OutboxOp, 'table' | 'kind' | 'rowKey'> & Partial<OutboxOp>) =>
    db.outbox.add({ opId: newId(), createdAt: new Date().toISOString(), attempts: 0, status: 'pending', ...op });
  const opsFor = (table: SyncTable, rowKey: string) =>
    db.outbox
      .where('rowKey')
      .equals(rowKey)
      .filter((o) => o.table === table)
      .sortBy('seq');

  return {
    async upsert(table, row) {
      const r = row as unknown as Record<string, unknown>;
      const rowKey = rowKeyOf(table, r);
      await db.table(table).put(row);
      const last = (await opsFor(table, rowKey)).at(-1);
      if (last && last.kind === 'upsert' && canCoalesce(last)) {
        await db.outbox.update(last.seq as number, { row: r });
      } else {
        await add({ table, kind: 'upsert', rowKey, row: r });
      }
    },

    async update(table, id, patch) {
      const p = patch as Record<string, unknown>;
      await db.table(table).update(id, p);
      const last = (await opsFor(table, id)).at(-1);
      if (last && (last.kind === 'upsert' || last.kind === 'update') && canCoalesce(last)) {
        const key = last.kind === 'upsert' ? 'row' : 'patch';
        await db.outbox.update(last.seq as number, { [key]: { ...last[key], ...p } });
      } else {
        await add({ table, kind: 'update', rowKey: id, patch: p });
      }
    },

    async remove(table, id) {
      await db.table(table).delete(id);
      const ops = await opsFor(table, id);
      if (ops.length > 0 && ops[0].kind === 'upsert' && ops.every(canCoalesce)) {
        // Created and deleted before ever reaching the server: nothing to push.
        await db.outbox.bulkDelete(ops.map((o) => o.seq as number));
        return;
      }
      const stale = ops.filter((o) => o.kind === 'update' && canCoalesce(o)).map((o) => o.seq as number);
      if (stale.length > 0) await db.outbox.bulkDelete(stale);
      await add({ table, kind: 'delete', rowKey: id });
    },

    async updateWhere(table, match, patch) {
      const m = match as Record<string, unknown>;
      const p = patch as Record<string, unknown>;
      await db
        .table(table)
        .filter((r) => Object.entries(m).every(([k, v]) => r[k] === v))
        .modify(p);
      await add({ table, kind: 'updateWhere', rowKey: JSON.stringify(m), match: m, patch: p });
    },
  };
}

/**
 * Applies local changes and queues the matching pushes in one transaction, so
 * the data and the outbox never disagree. Then tells screens to reload and
 * asks the sync engine to push.
 */
export async function localWrite(
  db: PulseDB,
  tables: SyncTable[],
  fn: (w: LocalWriter) => Promise<void>,
): Promise<void> {
  await db.transaction('rw', [...tables.map((t) => db.table(t)), db.outbox], () => fn(makeWriter(db)));
  window.dispatchEvent(new Event(DATA_CHANGED));
  requestSync();
}
