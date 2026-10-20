-- Pulse: Money (wallet and budgeting).
-- Amounts are whole centavos (bigint) so totals never drift. Currency is
-- stored per account; the app uses PHP.

-- ---------------------------------------------------------------------------
-- Accounts: created by the user (cash, bank, e-wallet, card, savings, other)
-- ---------------------------------------------------------------------------
create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null default 'cash'
    check (kind in ('cash', 'bank', 'ewallet', 'card', 'savings', 'other')),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  opening_balance_centavos bigint not null default 0,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  -- lets records reference (id, user_id) so they can only use their owner's accounts
  unique (id, user_id)
);
create index money_accounts_user_idx on public.money_accounts (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- Categories: built-in (user_id null) plus the user's own
-- ---------------------------------------------------------------------------
create table public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (length(trim(name)) between 1 and 30),
  icon text not null default 'dots',
  sort_order smallint not null default 0
);
create index money_categories_user_idx on public.money_categories (user_id);

-- ---------------------------------------------------------------------------
-- Records: expense, income, or transfer between two of the user's accounts
-- ---------------------------------------------------------------------------
create table public.money_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount_centavos bigint not null check (amount_centavos > 0),
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid references public.money_categories (id) on delete set null,
  note text check (note is null or length(note) <= 200),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Deleting an account deletes its records (the app confirms first).
  foreign key (account_id, user_id) references public.money_accounts (id, user_id) on delete cascade,
  foreign key (to_account_id, user_id) references public.money_accounts (id, user_id) on delete cascade,
  check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null)
  )
);
create index money_records_user_time_idx on public.money_records (user_id, occurred_at desc);
create index money_records_account_idx on public.money_records (account_id);
create index money_records_to_account_idx on public.money_records (to_account_id);

-- ---------------------------------------------------------------------------
-- Balances: opening balance plus every record that touches the account
-- ---------------------------------------------------------------------------
create view public.money_account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.opening_balance_centavos
    + coalesce(sum(
        case
          when r.type = 'income' and r.account_id = a.id then r.amount_centavos
          when r.type = 'expense' and r.account_id = a.id then -r.amount_centavos
          when r.type = 'transfer' and r.account_id = a.id then -r.amount_centavos
          when r.type = 'transfer' and r.to_account_id = a.id then r.amount_centavos
          else 0
        end
      ), 0) as balance_centavos
from public.money_accounts a
left join public.money_records r on r.account_id = a.id or r.to_account_id = a.id
group by a.id, a.opening_balance_centavos;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.money_accounts enable row level security;
alter table public.money_categories enable row level security;
alter table public.money_records enable row level security;

create policy "money_accounts: own" on public.money_accounts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "money_categories: read built-in and own" on public.money_categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "money_categories: write own" on public.money_categories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "money_records: own" on public.money_records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      category_id is null
      or exists (
        select 1 from public.money_categories c
        where c.id = category_id and (c.user_id is null or c.user_id = (select auth.uid()))
      )
    )
  );

grant select, insert, update, delete on public.money_accounts to authenticated;
grant select, insert, update, delete on public.money_categories to authenticated;
grant select, insert, update, delete on public.money_records to authenticated;
grant select on public.money_account_balances to authenticated;
revoke all on public.money_accounts, public.money_categories, public.money_records, public.money_account_balances from anon;

-- ---------------------------------------------------------------------------
-- Built-in categories
-- ---------------------------------------------------------------------------
insert into public.money_categories (id, user_id, kind, name, icon, sort_order) values
  ('00000000-0000-4000-8002-000000000001', null, 'expense', 'Food and drinks', 'food',      1),
  ('00000000-0000-4000-8002-000000000002', null, 'expense', 'Transport',       'car',       2),
  ('00000000-0000-4000-8002-000000000003', null, 'expense', 'Bills',           'receipt',   3),
  ('00000000-0000-4000-8002-000000000004', null, 'expense', 'Shopping',        'bag',       4),
  ('00000000-0000-4000-8002-000000000005', null, 'expense', 'Health and gym',  'heart',     5),
  ('00000000-0000-4000-8002-000000000006', null, 'expense', 'Entertainment',   'ticket',    6),
  ('00000000-0000-4000-8002-000000000007', null, 'expense', 'Housing',         'home',      7),
  ('00000000-0000-4000-8002-000000000008', null, 'expense', 'Other expense',   'dots',      8),
  ('00000000-0000-4000-8002-000000000101', null, 'income',  'Salary',          'briefcase', 1),
  ('00000000-0000-4000-8002-000000000102', null, 'income',  'Business',        'store',     2),
  ('00000000-0000-4000-8002-000000000103', null, 'income',  'Gifts',           'gift',      3),
  ('00000000-0000-4000-8002-000000000104', null, 'income',  'Other income',    'dots',      4)
on conflict (id) do update set
  kind = excluded.kind, name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order;
