import type { IndexableType } from 'dexie';
import { App } from '@capacitor/app';
import { supabase } from '../lib/supabase';
import { dexieKeyOf, MIRRORED_TABLES, normalizeRow, rowKeyOf, tableConfig, type MirroredTable, type PulseDB } from './db';
import { onNetworkChange } from './network';
import { DATA_CHANGED, inflightSeqs, type OutboxOp } from './outbox';

type ErrorClass = 'transient' | 'auth' | 'missing' | 'permanent';

interface ErrLike {
  message?: string;
  code?: string;
  name?: string;
}
interface Res {
  data: unknown;
  error: ErrLike | null;
  status?: number;
}
/** Untyped view of the query builder: table names here are runtime strings. */
interface LooseQuery extends PromiseLike<Res> {
  select(columns: string): LooseQuery;
  order(column: string): LooseQuery;
  range(from: number, to: number): LooseQuery;
  upsert(row: unknown, options: { onConflict: string; ignoreDuplicates?: boolean }): LooseQuery;
  update(patch: unknown): LooseQuery;
  delete(): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  match(query: Record<string, unknown>): LooseQuery;
}
const from = (table: string) => (supabase as unknown as { from: (t: string) => LooseQuery }).from(table);

const PAGE = 1000;
const MIN_BACKOFF = 2000;
const MAX_BACKOFF = 60000;
const POLL_MS = 60000;

export interface SyncStatus {
  syncing: boolean;
  lastSyncedAt: string | null;
}

let ctx: { db: PulseDB; userId: string } | null = null;
let running: Promise<void> | null = null;
let rerun = false;
let backoff = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let syncing = false;
const listeners = new Set<(s: SyncStatus) => void>();
let lastSyncedAt: string | null = null;

function emit() {
  const s = { syncing, lastSyncedAt };
  listeners.forEach((l) => l(s));
}

/** Subscribe to syncing state changes. Returns an unsubscribe function. */
export function onSyncStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb);
  cb({ syncing, lastSyncedAt });
  return () => void listeners.delete(cb);
}

/** The table is not on the server (a migration has not been run yet). */
function isMissingRelation(error: ErrLike, status?: number): boolean {
  const code = error.code ?? '';
  if (code === 'PGRST205' || code === '42P01') return true;
  return status === 404 && /does not exist|schema cache|could not find the table/i.test(error.message ?? '');
}

/** Tables found missing on the server during the current sync cycle; their ops wait. */
const unavailable = new Set<string>();

function classify(error: ErrLike, status?: number): ErrorClass {
  const msg = `${error.name ?? ''} ${error.message ?? ''}`;
  const code = error.code ?? '';
  if (isMissingRelation(error, status)) return 'missing';
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(msg)) return 'auth';
  if (/AuthRetryableFetchError/i.test(msg) || /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(msg)) {
    return 'transient';
  }
  if (status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500)) return 'transient';
  if (/^5\d\d$/.test(code)) return 'transient';
  return 'permanent';
}

function thrownResult(e: unknown): Res {
  const err = e as ErrLike;
  return { data: null, error: { name: err?.name, message: err?.message ?? String(e) }, status: 0 };
}

function runOp(op: OutboxOp): PromiseLike<Res> {
  const t = from(op.table);
  const { keys, ignoreDuplicates } = tableConfig(op.table);
  /** Narrows an update/delete to the one row: every key column must match. */
  const target = (q: LooseQuery) => {
    const parts = op.rowKey.split(':');
    return keys.reduce((acc, k, i) => acc.eq(k, parts[i]), q);
  };
  switch (op.kind) {
    case 'upsert':
      return t.upsert(op.row, { onConflict: keys.join(','), ...(ignoreDuplicates ? { ignoreDuplicates: true } : {}) });
    case 'update':
      return target(t.update(op.patch));
    case 'delete':
      return target(t.delete());
    case 'updateWhere':
      return t.update(op.patch).match(op.match ?? {});
  }
}

type PushResult = 'done' | 'retry';

/** Pending ops that can be pushed now: those for tables known to be missing on the server wait. */
const pushable = (db: PulseDB) =>
  db.outbox
    .where('status')
    .equals('pending')
    .filter((o) => !unavailable.has(o.table));

/**
 * Pushes pending ops in order. Stops on a transient failure; permanent ones are parked as failed.
 * Ops for an optional table that is missing on the server stay pending and are skipped over.
 */
async function push(db: PulseDB): Promise<PushResult> {
  let refreshed = false;
  // Writes go out only under the account this database belongs to. With no session, or a different
  // account signed in, nothing is sent; the queue waits for the right account.
  if (await pushable(db).count()) {
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.id !== ctx?.userId) return 'retry';
  }
  for (;;) {
    const op = await pushable(db).first();
    if (!op) return 'done';
    const seq = op.seq as number;
    const owner = op.row?.user_id;
    if (typeof owner === 'string' && owner !== ctx?.userId) {
      // A queued row that names another account must never be sent from this one.
      await db.outbox.update(seq, { status: 'failed', lastError: 'This change belongs to a different account.' });
      continue;
    }
    inflightSeqs.add(seq);
    let res: Res;
    try {
      res = await runOp(op);
    } catch (e) {
      res = thrownResult(e);
    } finally {
      inflightSeqs.delete(seq);
    }
    if (!res.error) {
      await db.outbox.delete(seq);
      continue;
    }
    const kind = classify(res.error, res.status);
    if (kind === 'auth') {
      if (refreshed) return 'retry';
      refreshed = true;
      const { error } = await supabase.auth.refreshSession();
      if (error) return 'retry';
      continue;
    }
    if (kind === 'missing' && tableConfig(op.table).optional) {
      unavailable.add(op.table);
      await db.outbox.update(seq, { attempts: op.attempts + 1 });
      continue;
    }
    if (kind === 'transient') {
      await db.outbox.update(seq, { attempts: op.attempts + 1 });
      return 'retry';
    }
    await db.outbox.update(seq, {
      status: 'failed',
      attempts: op.attempts + 1,
      lastError: res.error.message ?? res.error.code ?? 'Rejected by the server.',
    });
  }
}

async function fetchAll(table: MirroredTable): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  // Composite-key tables have no id column: order by the last key column (unique within one user's rows).
  const order = tableConfig(table).keys.at(-1) as string;
  for (let offset = 0; ; offset += PAGE) {
    const res = await from(table)
      .select('*')
      .order(order)
      .range(offset, offset + PAGE - 1);
    if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code, status: res.status });
    const page = (res.data as Record<string, unknown>[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function pullTable(db: PulseDB, table: MirroredTable): Promise<void> {
  const server = (await fetchAll(table)).map((r) => normalizeRow(table, r));
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    // Rows with a queued or failed write keep their local version.
    const guarded = new Set((await db.outbox.where('table').equals(table).toArray()).map((o) => o.rowKey));
    const local = db.table(table);
    const keep = new Set<string>();
    for (const r of server) keep.add(rowKeyOf(table, r));
    const stale: IndexableType[] = [];
    await local.each((r: Record<string, unknown>) => {
      const k = rowKeyOf(table, r);
      if (!keep.has(k) && !guarded.has(k)) stale.push(dexieKeyOf(table, r));
    });
    await local.bulkDelete(stale);
    await local.bulkPut(server.filter((r) => !guarded.has(rowKeyOf(table, r))));
  });
}

async function pull(db: PulseDB): Promise<void> {
  for (const table of MIRRORED_TABLES) {
    // New local writes arrived mid-pull: push them first so they are not clobbered.
    if ((await pushable(db).count()) > 0) return;
    try {
      await pullTable(db, table);
    } catch (e) {
      // An optional table that is not on the server yet is skipped; anything else fails the pull.
      const err = e as ErrLike & { status?: number };
      if (!tableConfig(table).optional || !isMissingRelation(err, err.status)) throw e;
      unavailable.add(table);
    }
  }
  lastSyncedAt = new Date().toISOString();
  await db.meta.put({ key: 'lastPulledAt', value: lastSyncedAt });
  window.dispatchEvent(new Event(DATA_CHANGED));
}

async function cycle(): Promise<void> {
  if (!ctx) return;
  const { db } = ctx;
  unavailable.clear();
  try {
    if ((await push(db)) === 'retry') return scheduleRetry();
    if ((await pushable(db).count()) === 0) await pull(db);
    backoff = 0;
  } catch (e) {
    // A failed pull is retried later; a local database error is not recoverable by retrying fast.
    void e;
    scheduleRetry();
  }
}

function scheduleRetry() {
  backoff = backoff === 0 ? MIN_BACKOFF : Math.min(backoff * 2, MAX_BACKOFF);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void syncNow(), backoff);
}

/** Pushes pending writes, then pulls server data. Only one run at a time. */
export function syncNow(): Promise<void> {
  if (!ctx) return Promise.resolve();
  if (running) {
    rerun = true;
    return running;
  }
  clearTimeout(retryTimer);
  running = (async () => {
    syncing = true;
    emit();
    try {
      do {
        rerun = false;
        const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
        if (locks) await locks.request('pulse-sync', cycle);
        else await cycle();
      } while (rerun);
    } finally {
      syncing = false;
      running = null;
      emit();
    }
  })();
  return running;
}

/** Sync soon; bursts of writes collapse into one run. */
export function requestSync(): void {
  if (!ctx) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), 500);
}

/** Drop a failed op (the local change is lost) and re-pull the server's version. */
export async function discardFailed(seq: number): Promise<void> {
  if (!ctx) return;
  await ctx.db.outbox.delete(seq);
  window.dispatchEvent(new Event(DATA_CHANGED));
  await syncNow();
}

/**
 * Wires the sync triggers for a signed-in user: start, network back, app
 * resume or tab visible, and a 60s poll while writes are pending.
 * Returns a function that stops everything.
 */
export function startSync(db: PulseDB, userId: string): () => void {
  ctx = { db, userId };
  lastSyncedAt = null;
  void db.meta.get('lastPulledAt').then((m) => {
    if (typeof m?.value === 'string') {
      lastSyncedAt = m.value;
      emit();
    }
  });
  const trigger = () => void syncNow();
  const offNet = onNetworkChange((online) => {
    if (online) trigger();
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible') trigger();
  };
  document.addEventListener('visibilitychange', onVisible);
  const appHandle = App.addListener('appStateChange', (s) => {
    if (s.isActive) trigger();
  });
  const poll = setInterval(() => {
    void db.outbox.where('status').equals('pending').count().then((n) => {
      if (n > 0) trigger();
    });
  }, POLL_MS);
  trigger();

  return () => {
    offNet();
    document.removeEventListener('visibilitychange', onVisible);
    void appHandle.then((h) => h.remove()).catch(() => undefined);
    clearInterval(poll);
    clearTimeout(retryTimer);
    clearTimeout(debounceTimer);
    backoff = 0;
    ctx = null;
  };
}
