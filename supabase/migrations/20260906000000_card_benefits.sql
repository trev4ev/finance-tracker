-- Credit card benefit definitions and per-period redemptions.
-- Replaces budgets in the app UI; the unused budgets table is left in place.

create table public.card_benefits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('monthly', 'semiannual', 'annual')),
  expected_amount numeric(14, 2) check (
    expected_amount is null or expected_amount >= 0
  ),
  cycle_start_month smallint not null default 1 check (
    cycle_start_month between 1 and 12
  ),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.benefit_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  benefit_id uuid not null references public.card_benefits (id) on delete cascade,
  period_start text not null check (period_start ~ '^\d{4}-\d{2}$'),
  used_on date not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create unique index benefit_redemptions_transaction_uidx
  on public.benefit_redemptions (transaction_id)
  where transaction_id is not null;

create index card_benefits_user_id_idx on public.card_benefits (user_id);
create index card_benefits_account_id_idx on public.card_benefits (account_id);
create index benefit_redemptions_user_id_idx on public.benefit_redemptions (user_id);
create index benefit_redemptions_benefit_id_idx on public.benefit_redemptions (benefit_id);
create index benefit_redemptions_period_idx
  on public.benefit_redemptions (benefit_id, period_start);

create trigger card_benefits_set_updated_at
  before update on public.card_benefits
  for each row execute function public.set_updated_at();

alter table public.card_benefits enable row level security;
alter table public.benefit_redemptions enable row level security;

create policy "card_benefits_owner_all"
  on public.card_benefits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "benefit_redemptions_owner_all"
  on public.benefit_redemptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.card_benefits to authenticated;
grant all on table public.benefit_redemptions to authenticated;
