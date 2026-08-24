-- Ledger finance schema: per-user accounts, balances, transactions, and Plaid items.
-- Apply with the Supabase CLI (`supabase db push`) or the SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#94a3b8',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id text not null,
  access_token_encrypted text not null,
  institution_id text,
  institution_name text,
  status text not null default 'active' check (status in ('active', 'error', 'revoked')),
  transactions_cursor text,
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_item_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (
    type in ('checking', 'savings', 'credit', 'cash', 'investment', 'loan', 'other')
  ),
  starting_balance numeric(14, 2) not null default 0,
  current_balance numeric(14, 2),
  available_balance numeric(14, 2),
  currency text not null default 'USD',
  source text not null default 'manual' check (source in ('manual', 'plaid')),
  plaid_item_id uuid references public.plaid_items (id) on delete cascade,
  plaid_account_id text,
  institution_name text,
  mask text,
  official_name text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index accounts_user_plaid_account_uidx
  on public.accounts (user_id, plaid_account_id)
  where plaid_account_id is not null;

create table public.account_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  current numeric(14, 2),
  available numeric(14, 2),
  iso_currency_code text not null default 'USD',
  source text not null default 'plaid' check (source in ('plaid', 'manual', 'computed')),
  as_of timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  type text not null check (type in ('income', 'expense', 'transfer')),
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  notes text not null default '',
  source text not null default 'manual' check (source in ('manual', 'plaid')),
  plaid_transaction_id text,
  pending boolean not null default false,
  merchant_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transactions_user_plaid_tx_uidx
  on public.transactions (user_id, plaid_transaction_id)
  where plaid_transaction_id is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index categories_user_id_idx on public.categories (user_id);
create index plaid_items_user_id_idx on public.plaid_items (user_id);
create index accounts_user_id_idx on public.accounts (user_id);
create index account_balances_account_as_of_idx
  on public.account_balances (account_id, as_of desc);
create index account_balances_user_id_idx on public.account_balances (user_id);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index budgets_user_month_idx on public.budgets (user_id, month);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger plaid_items_set_updated_at
  before update on public.plaid_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default categories for each new user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, kind, color) values
    (new.id, 'Salary', 'income', '#34d399'),
    (new.id, 'Freelance', 'income', '#6ee7b7'),
    (new.id, 'Rent', 'expense', '#fb7185'),
    (new.id, 'Groceries', 'expense', '#fbbf24'),
    (new.id, 'Dining', 'expense', '#f97316'),
    (new.id, 'Transport', 'expense', '#38bdf8'),
    (new.id, 'Utilities', 'expense', '#818cf8'),
    (new.id, 'Subscriptions', 'expense', '#c084fc'),
    (new.id, 'Healthcare', 'expense', '#2dd4bf'),
    (new.id, 'Shopping', 'expense', '#f472b6'),
    (new.id, 'Entertainment', 'expense', '#a3e635');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.plaid_items enable row level security;
alter table public.accounts enable row level security;
alter table public.account_balances enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "categories_owner_all"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "plaid_items_owner_all"
  on public.plaid_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "accounts_owner_all"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "account_balances_owner_all"
  on public.account_balances for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_owner_all"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budgets_owner_all"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated, anon;
grant all on table public.categories to authenticated;
grant all on table public.plaid_items to authenticated;
grant all on table public.accounts to authenticated;
grant all on table public.account_balances to authenticated;
grant all on table public.transactions to authenticated;
grant all on table public.budgets to authenticated;

alter function public.set_updated_at() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;
