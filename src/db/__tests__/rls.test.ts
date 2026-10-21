// @vitest-environment node
/**
 * Database authorization tests. They run the real migrations and the real seed in an
 * in-memory Postgres (PGlite) and attack the policies as signed-in users and as anon:
 * cross-user reads, inserts, updates and deletes, privilege checks, and value limits.
 * Only auth.users and auth.uid() are stubbed (Supabase provides them in production).
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ROOT = join(__dirname, '../../../supabase');

let db: PGlite;

async function as<T = Record<string, unknown>>(role: 'anon' | 'authenticated', user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

/** Runs a statement as `user` and returns the error message, or null if it succeeded. */
async function failure(user: string | null, sql: string, params: unknown[] = [], role: 'anon' | 'authenticated' = 'authenticated') {
  try {
    await as(role, user, sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const admin = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    -- Supabase grants everything on new public tables to these roles by default
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  for (const f of readdirSync(join(ROOT, 'migrations')).sort()) {
    await db.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'));
  }
  await db.exec(readFileSync(join(ROOT, 'seed.sql'), 'utf8'));
  await admin(`insert into auth.users (id) values ($1), ($2)`, [A, B]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

/** One row owned by A in every user-owned table, plus the ids the tests need. */
const ids: Record<string, string> = {};

beforeAll(async () => {
  const w = (await admin(`select id from public.workouts where owner is null limit 1`)).rows[0].id as string;
  const ex = (await admin(`select id from public.workout_exercises where workout_id = $1 limit 1`, [w])).rows[0].id as string;
  const q = async (key: string, sql: string, params: unknown[] = []) => {
    ids[key] = (await admin(sql, params)).rows[0].id as string;
  };
  ids.workout = w;
  ids.exercise = ex;
  await q('session', `insert into public.workout_sessions (user_id, workout_id) values ($1, $2) returning id`, [A, w]);
  await q('set', `insert into public.set_logs (session_id, exercise_id, set_number, reps) values ($1, $2, 1, 8) returning id`, [ids.session, ex]);
  await q('activity', `insert into public.activity_logs (user_id, type, duration_min) values ($1, 'run', 30) returning id`, [A]);
  await q('pr', `insert into public.personal_records (user_id, name, value, unit) values ($1, 'Bench', 50, 'kg') returning id`, [A]);
  await q('account', `insert into public.money_accounts (user_id, name) values ($1, 'Cash') returning id`, [A]);
  await q('account2', `insert into public.money_accounts (user_id, name) values ($1, 'Bank') returning id`, [A]);
  await q('record', `insert into public.money_records (user_id, type, amount_centavos, account_id) values ($1, 'expense', 5000, $2) returning id`, [A, ids.account]);
  await q('category', `insert into public.money_categories (user_id, kind, name) values ($1, 'expense', 'Mine') returning id`, [A]);
  await q('plan', `insert into public.user_plans (user_id, name, total_weeks, is_active) values ($1, 'Mine', 4, false) returning id`, [A]);
  await q('slot', `insert into public.plan_workouts (plan_id, workout_id, week_number, position) values ($1, $2, 1, 1) returning id`, [ids.plan, w]);
  await q('ownworkout', `insert into public.workouts (owner, name, category, duration_min, level, equipment) values ($1, 'Private', 'Strength', 30, 'Beginner', 'None') returning id`, [A]);
  await q('ownexercise', `insert into public.workout_exercises (workout_id, position, name, muscles, target_sets, rep_min, rep_max, rest_seconds) values ($1, 1, 'Secret lift', '{Chest}', 3, 8, 10, 60) returning id`, [ids.ownworkout]);
  await admin(`insert into public.exercise_load_prefs (user_id, exercise_id, unit) values ($1, $2, 'kg')`, [A, ex]);
  const ach = (await admin(`select id from public.achievements limit 1`)).rows[0].id as string;
  ids.achievement = ach;
  await admin(`insert into public.user_achievements (user_id, achievement_id) values ($1, $2)`, [A, ach]);
});

/** table, key column and id key for the rows A owns. Rows are reachable by B only if a policy is wrong. */
const OWNED: [table: string, idKey: string][] = [
  ['workout_sessions', 'session'],
  ['set_logs', 'set'],
  ['activity_logs', 'activity'],
  ['personal_records', 'pr'],
  ['money_accounts', 'account'],
  ['money_records', 'record'],
  ['money_categories', 'category'],
  ['user_plans', 'plan'],
  ['plan_workouts', 'slot'],
  ['workouts', 'ownworkout'],
  ['workout_exercises', 'ownexercise'],
];

describe('anonymous visitors', () => {
  const tables = [...OWNED.map(([t]) => t), 'profiles', 'user_achievements', 'exercise_load_prefs', 'achievements', 'money_account_balances'];
  it.each(tables)('cannot read %s', async (table) => {
    expect(await failure(null, `select * from public.${table}`, [], 'anon')).toMatch(/permission denied/i);
  });
  it('cannot write anything', async () => {
    expect(await failure(null, `insert into public.activity_logs (user_id, type, duration_min) values ($1, 'run', 1)`, [A], 'anon')).toMatch(
      /permission denied/i,
    );
  });
});

describe('a signed-in user cannot touch another user\'s rows', () => {
  it.each(OWNED)('%s: read, update and delete are blocked for B', async (table, key) => {
    const id = ids[key];
    expect((await as('authenticated', B, `select id from public.${table} where id = $1`, [id])).rows).toHaveLength(0);

    const upd = await as('authenticated', B, `update public.${table} set id = id where id = $1`, [id]);
    expect(upd.affectedRows).toBe(0);

    const del = await as('authenticated', B, `delete from public.${table} where id = $1`, [id]);
    expect(del.affectedRows).toBe(0);

    expect((await admin(`select 1 from public.${table} where id = $1`, [id])).rows).toHaveLength(1);
  });

  it('the owner can still read their own rows', async () => {
    for (const [table, key] of OWNED) {
      const r = await as('authenticated', A, `select id from public.${table} where id = $1`, [ids[key]]);
      expect(r.rows, table).toHaveLength(1);
    }
  });

  it('exercise preferences, profiles and achievements are private', async () => {
    expect((await as('authenticated', B, `select * from public.exercise_load_prefs`)).rows).toHaveLength(0);
    expect((await as('authenticated', B, `select * from public.user_achievements`)).rows).toHaveLength(0);
    const profiles = await as<{ id: string }>('authenticated', B, `select id from public.profiles`);
    expect(profiles.rows.map((p) => p.id)).toEqual([B]);
  });

  it('B cannot insert rows that belong to A', async () => {
    const attempts: [string, unknown[]][] = [
      [`insert into public.activity_logs (user_id, type, duration_min) values ($1, 'run', 1)`, [A]],
      [`insert into public.workout_sessions (user_id, workout_id) values ($1, $2)`, [A, ids.workout]],
      [`insert into public.money_accounts (user_id, name) values ($1, 'x')`, [A]],
      [`insert into public.personal_records (user_id, name, value, unit) values ($1, 'x', 1, 'kg')`, [A]],
      [`insert into public.user_plans (user_id, name, total_weeks, is_active) values ($1, 'x', 1, false)`, [A]],
      [`insert into public.workouts (owner, name, category, duration_min, level, equipment) values ($1, 'x', 'Strength', 5, 'Beginner', 'None')`, [A]],
      [`insert into public.exercise_load_prefs (user_id, exercise_id, unit) values ($1, $2, 'kg')`, [A, ids.exercise]],
      [`insert into public.user_achievements (user_id, achievement_id) values ($1, $2)`, [A, ids.achievement]],
    ];
    for (const [sql, params] of attempts) {
      expect(await failure(B, sql, params), sql).toMatch(/row-level security|violates|permission/i);
    }
  });

  it('B cannot attach rows to A\'s sessions, plans or workouts', async () => {
    expect(
      await failure(B, `insert into public.set_logs (session_id, exercise_id, set_number, reps) values ($1, $2, 2, 5)`, [ids.session, ids.exercise]),
    ).toMatch(/row-level security/i);
    expect(
      await failure(B, `insert into public.plan_workouts (plan_id, workout_id, week_number, position) values ($1, $2, 1, 9)`, [ids.plan, ids.workout]),
    ).toMatch(/row-level security/i);
    expect(
      await failure(
        B,
        `insert into public.workout_exercises (workout_id, position, name, muscles, target_sets, rep_min, rep_max, rest_seconds) values ($1, 9, 'x', '{}', 1, 1, 1, 0)`,
        [ids.ownworkout],
      ),
    ).toMatch(/row-level security/i);
  });

  it('B cannot record money against A\'s account', async () => {
    const err = await failure(B, `insert into public.money_records (user_id, type, amount_centavos, account_id) values ($1, 'expense', 100, $2)`, [B, ids.account]);
    expect(err).toMatch(/foreign key|violates/i);
  });

  it('B cannot use A\'s private money category', async () => {
    await admin(`insert into public.money_accounts (id, user_id, name) values ('33333333-3333-4333-8333-333333333333', $1, 'B cash')`, [B]);
    const err = await failure(
      B,
      `insert into public.money_records (user_id, type, amount_centavos, account_id, category_id) values ($1, 'expense', 100, '33333333-3333-4333-8333-333333333333', $2)`,
      [B, ids.category],
    );
    expect(err).toMatch(/row-level security/i);
  });

  it('a row cannot be reassigned to another user', async () => {
    expect(await failure(A, `update public.activity_logs set user_id = $1 where id = $2`, [B, ids.activity])).toMatch(/row-level security/i);
    expect(await failure(A, `update public.workouts set owner = $1 where id = $2`, [B, ids.ownworkout])).toMatch(/row-level security/i);
    expect(await failure(A, `update public.profiles set id = $1 where id = $2`, [B, A])).toMatch(/row-level security|violates|duplicate/i);
  });
});

describe('shared catalogue', () => {
  it('built-in workouts and achievements are readable by any signed-in user', async () => {
    expect((await as('authenticated', B, `select 1 from public.workouts where owner is null`)).rows.length).toBeGreaterThan(0);
    expect((await as('authenticated', B, `select 1 from public.achievements`)).rows.length).toBeGreaterThan(0);
  });
  it('but they cannot be edited, deleted or extended', async () => {
    const del = await as('authenticated', B, `delete from public.workouts where owner is null`);
    expect(del.affectedRows).toBe(0);
    const upd = await as('authenticated', B, `update public.workouts set name = 'hacked' where owner is null`);
    expect(upd.affectedRows).toBe(0);
    expect(await failure(B, `insert into public.achievements (code, name, description, icon) values ('x','x','x','x')`)).toMatch(
      /permission denied|row-level security|null value|violates/i,
    );
    expect(await failure(B, `update public.achievements set name = 'x'`)).toMatch(/permission denied/i);
    expect(await failure(B, `delete from public.achievements`)).toMatch(/permission denied/i);
    expect(await failure(B, `update public.workout_exercises set name = 'hacked' where workout_id = $1`, [ids.workout])).toBeNull();
    expect((await admin(`select 1 from public.workout_exercises where name = 'hacked'`)).rows).toHaveLength(0);
  });
});

describe('least privilege (migration 0007)', () => {
  it('signed-in users cannot truncate tables, even the ones they own', async () => {
    for (const [table] of OWNED) {
      expect(await failure(A, `truncate public.${table} cascade`), table).toMatch(/permission denied/i);
    }
  });
  it('profiles cannot be inserted or deleted through the API', async () => {
    expect(await failure(A, `delete from public.profiles where id = $1`, [A])).toMatch(/permission denied/i);
    expect(await failure(A, `insert into public.profiles (id) values (gen_random_uuid())`)).toMatch(/permission denied/i);
  });
  it('earned achievements cannot be edited or removed by the client', async () => {
    expect(await failure(A, `update public.user_achievements set earned_at = now()`)).toMatch(/permission denied/i);
    expect(await failure(A, `delete from public.user_achievements`)).toMatch(/permission denied/i);
  });
  it('internal functions are not callable', async () => {
    expect(await failure(A, `select public.enrol_default_plan($1)`, [A])).toMatch(/permission denied/i);
    expect(await failure(A, `select public.handle_new_user()`)).toMatch(/permission denied/i);
    expect(await failure(A, `select public.set_updated_at()`)).toMatch(/permission denied/i);
  });
  it('the balances view only shows the caller\'s accounts', async () => {
    const mine = await as<{ id: string }>('authenticated', A, `select account_id as id from public.money_account_balances`);
    expect(mine.rows.length).toBeGreaterThan(0);
    expect((await as('authenticated', B, `select account_id as id from public.money_account_balances where account_id = $1`, [ids.account])).rows).toHaveLength(0);
  });
});

describe('value limits (migration 0007)', () => {
  const cases: [string, string, unknown[]][] = [
    ['absurd rep count', `insert into public.set_logs (session_id, exercise_id, set_number, reps) values ($1, $2, 9, 30000)`, [ids.session ?? '', ids.exercise ?? '']],
    ['absurd money amount', `insert into public.money_records (user_id, type, amount_centavos, account_id) values ($1, 'expense', 900000000000000, $2)`, [A, '']],
    ['huge profile name', `update public.profiles set display_name = repeat('x', 5000) where id = $1`, [A]],
    ['huge session notes', `update public.workout_sessions set notes = repeat('x', 100000) where id = $1`, ['']],
    ['25-hour activity', `insert into public.activity_logs (user_id, type, duration_min) values ($1, 'run', 5000)`, [A]],
  ];
  it.each(cases)('rejects %s', async (_name, sql, params) => {
    const fill = params.map((p) => (p === '' ? (sql.includes('money_records') ? ids.account : ids.session) : p));
    const real = sql.includes('set_logs') ? [ids.session, ids.exercise] : fill;
    expect(await failure(A, sql, real)).toMatch(/check constraint|violates/i);
  });
  it('still accepts normal values', async () => {
    expect(await failure(A, `update public.profiles set display_name = 'Robert' where id = $1`, [A])).toBeNull();
    expect(await failure(A, `insert into public.activity_logs (user_id, type, duration_min, kcal) values ($1, 'run', 45, 500)`, [A])).toBeNull();
  });
});
