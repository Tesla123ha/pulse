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
  eqs?: Record<string, unknown>;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  range?: [number, number];
}

// vi.mock is hoisted, so the fake server state lives in a hoisted holder.
const fake = vi.hoisted(() => {
  const state = {
    calls: [] as Call[],
    server: {} as Record<string, Record<string, unknown>[]>,
    /** Returns a result to force for a write, or undefined for success. */
    /** Tables that do not exist on the server: every request to them fails like PostgREST. */
    missing: new Set<string>(),
    /** The account signed in right now, or null for no session. */
    sessionUser: 'sync-user' as string | null,
    writeHook: undefined as undefined | ((c: Call) => Res | undefined | 'throw-network'),
  };
  const session = () => (state.sessionUser ? { user: { id: state.sessionUser } } : null);
  const ok: Res = { data: null, error: null, status: 200 };
  function from(table: string) {
    const call: Call = { table, kind: 'select' };
    const q = {
      select: () => q,
      order: () => q,
      range: (a: number, b: number) => ((call.range = [a, b]), q),
      upsert: (row: unknown, o?: { onConflict: string; ignoreDuplicates?: boolean }) => (
        (call.kind = 'upsert'), (call.arg = row), (call.onConflict = o?.onConflict), (call.ignoreDuplicates = o?.ignoreDuplicates), q
      ),
      update: (patch: unknown) => ((call.kind = 'update'), (call.arg = patch), q),
      delete: () => ((call.kind = 'delete'), q),
      eq: (c: string, v: unknown) => ((call.eq = v), (call.eqs = { ...call.eqs, [c]: v }), q),
      match: (m: unknown) => ((call.eq = m), q),
      then(resolve: (r: Res) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve()
          .then((): Res => {
            state.calls.push(call);
            if (state.missing.has(table)) {
              return {
                data: null,
                error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` },
                status: 404,
              };
            }
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
              const row = call.arg as Record<string, unknown>;
              const cols = (call.onConflict ?? 'id').split(',');
              const i = rows.findIndex((r) => cols.every((c) => r[c] === row[c]));
              if (i >= 0) rows[i] = row;
              else rows.push(row);
            } else if (call.kind === 'delete') {
              const eqs = call.eqs ?? {};
              state.server[table] = rows.filter((r) => !Object.entries(eqs).every(([c, v]) => r[c] === v));
            }
            return ok;
          })
          .then(resolve, reject);
      },
    };
    return q;
  }
  return { state, from, session };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fake.from,
    auth: {
      refreshSession: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: fake.session() }, error: null }),
    },
  },
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
  state.missing = new Set();
  state.sessionUser = U;
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

describe('composite keys', () => {
  const pref = (exercise_id: string, unit: string) => ({ user_id: U, exercise_id, unit, updated_at: 't' }) as never;

  it('upserts on both key columns, last write wins', async () => {
    await localWrite(db, ['exercise_load_prefs'], (w) => w.upsert('exercise_load_prefs', pref('e1', 'kg')));
    await syncNow();
    expect(writes()[0]).toMatchObject({ table: 'exercise_load_prefs', onConflict: 'user_id,exercise_id' });
    expect(writes()[0].ignoreDuplicates).toBeUndefined();
    await localWrite(db, ['exercise_load_prefs'], (w) => w.upsert('exercise_load_prefs', pref('e1', 'pl')));
    await syncNow();
    expect(state.server.exercise_load_prefs).toEqual([expect.objectContaining({ exercise_id: 'e1', unit: 'pl' })]);
    expect(await db.exercise_load_prefs.count()).toBe(1);
  });

  it('keeps first-write-wins for achievements', async () => {
    await localWrite(db, ['user_achievements'], (w) =>
      w.upsert('user_achievements', { user_id: U, achievement_id: 'a1', earned_at: 't' }),
    );
    await syncNow();
    expect(writes()[0]).toMatchObject({ onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
  });

  it('filters update and delete on both columns', async () => {
    state.server.exercise_load_prefs = [pref('e1', 'kg'), pref('e2', 'kg')] as never[];
    await syncNow();
    state.calls = [];
    await localWrite(db, ['exercise_load_prefs'], async (w) => {
      await w.update('exercise_load_prefs', [U, 'e1'], { unit: 'lb' });
      await w.remove('exercise_load_prefs', [U, 'e2']);
    });
    expect((await db.exercise_load_prefs.toArray()).map((r) => [r.exercise_id, r.unit])).toEqual([['e1', 'lb']]);
    await syncNow();
    const [upd, del] = writes();
    expect(upd).toMatchObject({ kind: 'update', eqs: { user_id: U, exercise_id: 'e1' } });
    expect(del).toMatchObject({ kind: 'delete', eqs: { user_id: U, exercise_id: 'e2' } });
    expect(state.server.exercise_load_prefs).toHaveLength(1);
  });
});

describe('a table the server does not have yet', () => {
  const pref = (exercise_id: string) => ({ user_id: U, exercise_id, unit: 'pl', updated_at: 't' }) as never;

  it('is skipped by the pull while the others still sync', async () => {
    state.missing.add('exercise_load_prefs');
    state.server.money_accounts = [acct('x') as never];
    await syncNow();
    expect((await db.money_accounts.toArray()).map((r) => r.id)).toEqual(['x']);
    expect(await db.meta.get('lastPulledAt')).toBeDefined();
  });

  it('keeps its ops pending while later ops of other tables still push', async () => {
    state.missing.add('exercise_load_prefs');
    await localWrite(db, ['exercise_load_prefs', 'money_accounts'], async (w) => {
      await w.upsert('exercise_load_prefs', pref('e1'));
      await w.upsert('exercise_load_prefs', pref('e2'));
      await w.upsert('money_accounts', acct('a'));
    });
    await syncNow();
    expect(state.server.money_accounts.map((r) => r.id)).toEqual(['a']);
    const ops = await db.outbox.toArray();
    expect(ops.map((o) => [o.table, o.status])).toEqual([
      ['exercise_load_prefs', 'pending'],
      ['exercise_load_prefs', 'pending'],
    ]);
    // Only the first op was tried; the table is skipped for the rest of the cycle.
    expect(writes().filter((c) => c.table === 'exercise_load_prefs')).toHaveLength(1);

    // The migration is run: the next sync pushes them.
    state.missing.clear();
    await syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(state.server.exercise_load_prefs).toHaveLength(2);
  });
});

describe('account binding', () => {
  it('sends nothing while a different account is signed in, and keeps the queue', async () => {
    state.sessionUser = 'someone-else';
    await localWrite(db, ['money_accounts'], async (w) => w.upsert('money_accounts', acct('mine')));
    await syncNow();
    expect(writes()).toHaveLength(0);
    expect(await pendingOps()).toHaveLength(1);
    // the right account signs back in: the queued change goes out
    state.sessionUser = U;
    await syncNow();
    expect(writes()).toHaveLength(1);
    expect(await pendingOps()).toHaveLength(0);
  });

  it('sends nothing without a session', async () => {
    state.sessionUser = null;
    await localWrite(db, ['money_accounts'], async (w) => w.upsert('money_accounts', acct('a1')));
    await syncNow();
    expect(writes()).toHaveLength(0);
    expect(await pendingOps()).toHaveLength(1);
  });

  it('parks a queued row that names another account instead of sending it', async () => {
    const foreign = { id: 'f1', user_id: 'other-user', name: 'x', opening_balance_centavos: 0 } as never;
    await localWrite(db, ['money_accounts'], async (w) => w.upsert('money_accounts', foreign));
    await syncNow();
    expect(writes()).toHaveLength(0);
    const failed = await db.outbox.where('status').equals('failed').toArray();
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toMatch(/different account/i);
  });
});
