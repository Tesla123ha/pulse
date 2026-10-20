import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Res {
  data: unknown;
  error: { message?: string; code?: string; name?: string } | null;
  status?: number;
}
interface Call {
  table: string;
  kind: 'select' | 'upsert' | 'update' | 'delete';
  arg?: unknown;
  eq?: unknown;
  range?: [number, number];
}

// vi.mock is hoisted, so the fake server state lives in a hoisted holder.
const fake = vi.hoisted(() => {
  const state = {
    calls: [] as Call[],
    server: {} as Record<string, Record<string, unknown>[]>,
    /** Returns a result to force for a write, or undefined for success. */
    writeHook: undefined as undefined | ((c: Call) => Res | undefined | 'throw-network'),
  };
  const ok: Res = { data: null, error: null, status: 200 };
  function from(table: string) {
    const call: Call = { table, kind: 'select' };
    const q = {
      select: () => q,
      order: () => q,
      range: (a: number, b: number) => ((call.range = [a, b]), q),
      upsert: (row: unknown) => ((call.kind = 'upsert'), (call.arg = row), q),
      update: (patch: unknown) => ((call.kind = 'update'), (call.arg = patch), q),
      delete: () => ((call.kind = 'delete'), q),
      eq: (_c: string, v: unknown) => ((call.eq = v), q),
      match: (m: unknown) => ((call.eq = m), q),
      then(resolve: (r: Res) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve()
          .then((): Res => {
            state.calls.push(call);
            if (call.kind === 'select') {
              const rows = state.server[table] ?? [];
              const [a, b] = call.range ?? [0, rows.length];
              return { data: rows.slice(a, b + 1), error: null, status: 200 };
            }
            const forced = state.writeHook?.(call);
            if (forced === 'throw-network') throw new TypeError('Failed to fetch');
            if (forced) return forced;
            const rows = (state.server[table] ??= []);
            if (call.kind === 'upsert') {
              const row = call.arg as { id: string };
              const i = rows.findIndex((r) => r.id === row.id);
              if (i >= 0) rows[i] = row;
              else rows.push(row);
            } else if (call.kind === 'delete') {
              state.server[table] = rows.filter((r) => r.id !== call.eq);
            }
            return ok;
          })
          .then(resolve, reject);
      },
    };
    return q;
  }
  return { state, from };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: fake.from, auth: { refreshSession: () => Promise.resolve({ error: null }) } },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(() => Promise.resolve({ remove() {} })) } }));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: () => Promise.resolve({ connected: true }), addListener: () => Promise.resolve({ remove() {} }) },
}));

import { closeUserDb, deleteUserDb, openUserDb, type PulseDB } from '../db';
import { localWrite } from '../outbox';
import { startSync, syncNow } from '../sync';

const U = 'sync-user';
const state = fake.state;
let db: PulseDB;
let stop: () => void;

const acct = (id: string, name = id) => ({ id, user_id: U, name, opening_balance_centavos: 0 }) as never;
const writes = () => state.calls.filter((c) => c.kind !== 'select');
const pendingOps = () => db.outbox.where('status').equals('pending').toArray();

beforeEach(async () => {
  closeUserDb();
  await deleteUserDb(U);
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  state.calls = [];
  state.server = {};
  state.writeHook = undefined;
  db = await openUserDb(U);
  stop = startSync(db, U);
  await syncNow(); // let the initial (empty) cycle finish
  state.calls = [];
});

afterEach(() => {
  stop();
});

describe('push', () => {
  it('pushes ops in FIFO seq order', async () => {
    await localWrite(db, ['money_accounts'], async (w) => {
      await w.upsert('money_accounts', acct('a'));
      await w.upsert('money_accounts', acct('b'));
      await w.upsert('money_accounts', acct('c'));
    });
    await syncNow();
    expect(writes().map((c) => (c.arg as { id: string }).id)).toEqual(['a', 'b', 'c']);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps the op pending on a transient error and retries without duplicating', async () => {
    state.writeHook = () => 'throw-network';
    await localWrite(db, ['money_accounts'], (w) => w.upsert('money_accounts', acct('a')));
    await syncNow();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].status).toBe('pending');
    expect(ops[0].lastError).toBeUndefined();
    expect(state.server.money_accounts ?? []).toHaveLength(0);

    state.writeHook = undefined;
    await syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(state.server.money_accounts).toHaveLength(1);
    expect(state.server.money_accounts[0].id).toBe('a');
  });

  it('stops at a transient error and does not push later ops', async () => {
    state.writeHook = (c) => ((c.arg as { id: string }).id === 'a' ? 'throw-network' : undefined);
    await localWrite(db, ['money_accounts'], async (w) => {
      await w.upsert('money_accounts', acct('a'));
      await w.upsert('money_accounts', acct('b'));
    });
    await syncNow();
    expect(writes().map((c) => (c.arg as { id: string }).id)).toEqual(['a']);
    expect(await pendingOps()).toHaveLength(2);
  });

  it('marks a permanent error failed with lastError and continues to later ops', async () => {
    state.writeHook = (c) =>
      (c.arg as { id: string }).id === 'a'
        ? { data: null, error: { code: '23505', message: 'duplicate key value' }, status: 409 }
        : undefined;
    await localWrite(db, ['money_accounts'], async (w) => {
      await w.upsert('money_accounts', acct('a'));
      await w.upsert('money_accounts', acct('b'));
    });
    await syncNow();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].rowKey).toBe('a');
    expect(ops[0].status).toBe('failed');
    expect(ops[0].lastError).toBe('duplicate key value');
    expect(state.server.money_accounts.map((r) => r.id)).toEqual(['b']);
  });
});

describe('pull', () => {
  it('does not resurrect a row whose delete is parked, nor overwrite a parked update', async () => {
    state.server.money_accounts = [acct('d', 'server-d') as never, acct('u', 'server-u') as never];
    await syncNow();
    expect(await db.money_accounts.count()).toBe(2);

    state.writeHook = () => ({ data: null, error: { code: '42501', message: 'denied' }, status: 403 });
    await localWrite(db, ['money_accounts'], async (w) => {
      await w.remove('money_accounts', 'd');
      await w.update('money_accounts', 'u', { name: 'local-u' } as never);
    });
    await syncNow();
    expect((await db.outbox.toArray()).every((o) => o.status === 'failed')).toBe(true);
    expect(await db.money_accounts.get('d')).toBeUndefined();
    expect((await db.money_accounts.get('u') as { name: string }).name).toBe('local-u');
  });

  it('does not pull (so cannot clobber) while a delete is still pending', async () => {
    state.server.money_accounts = [acct('d') as never];
    await syncNow();
    state.writeHook = () => 'throw-network';
    await localWrite(db, ['money_accounts'], (w) => w.remove('money_accounts', 'd'));
    state.calls = [];
    await syncNow();
    expect(state.calls.filter((c) => c.kind === 'select')).toHaveLength(0);
    expect(await db.money_accounts.get('d')).toBeUndefined();
    expect(await pendingOps()).toHaveLength(1);
  });

  it('removes local rows that were deleted on the server', async () => {
    state.server.money_accounts = [acct('x') as never, acct('y') as never];
    await syncNow();
    expect(await db.money_accounts.count()).toBe(2);
    state.server.money_accounts = [acct('y') as never];
    await syncNow();
    expect((await db.money_accounts.toArray()).map((r) => r.id)).toEqual(['y']);
  });

  it('is paginated: 1000 + 5 rows are all fetched', async () => {
    state.server.money_accounts = Array.from({ length: 1005 }, (_, i) => acct(`r${String(i).padStart(4, '0')}`) as never);
    state.calls = [];
    await syncNow();
    expect(await db.money_accounts.count()).toBe(1005);
    const ranges = state.calls.filter((c) => c.table === 'money_accounts' && c.kind === 'select').map((c) => c.range);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});

describe('local write coalescing', () => {
  it('upsert then delete before any push leaves no ops', async () => {
    await localWrite(db, ['money_accounts'], (w) => w.upsert('money_accounts', acct('n')));
    await localWrite(db, ['money_accounts'], (w) => w.remove('money_accounts', 'n'));
    expect(await db.outbox.count()).toBe(0);
    expect(await db.money_accounts.get('n')).toBeUndefined();
    await syncNow();
    expect(writes()).toHaveLength(0);
  });

  it('merges repeated updates to one unpushed row into one op', async () => {
    state.writeHook = () => 'throw-network';
    await localWrite(db, ['money_accounts'], (w) => w.upsert('money_accounts', acct('m', 'one')));
    await localWrite(db, ['money_accounts'], (w) => w.update('money_accounts', 'm', { name: 'two' } as never));
    await localWrite(db, ['money_accounts'], (w) => w.update('money_accounts', 'm', { opening_balance_centavos: 5 } as never));
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('upsert');
    expect(ops[0].row).toMatchObject({ id: 'm', name: 'two', opening_balance_centavos: 5 });
  });

  it('merges repeated updates to an already-synced row into one update op', async () => {
    state.server.money_accounts = [acct('s') as never];
    await syncNow();
    state.writeHook = () => 'throw-network';
    await localWrite(db, ['money_accounts'], (w) => w.update('money_accounts', 's', { name: 'a' } as never));
    await localWrite(db, ['money_accounts'], (w) => w.update('money_accounts', 's', { name: 'b', opening_balance_centavos: 9 } as never));
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('update');
    expect(ops[0].patch).toEqual({ name: 'b', opening_balance_centavos: 9 });
  });
});
