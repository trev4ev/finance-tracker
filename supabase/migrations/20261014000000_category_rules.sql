-- Merchant recategorization rules. Applied on save (optional retroactive)
-- and to newly inserted Plaid transactions.

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_key text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index category_rules_user_id_idx on public.category_rules (user_id);

create trigger category_rules_set_updated_at
  before update on public.category_rules
  for each row execute function public.set_updated_at();

alter table public.category_rules enable row level security;

create policy "category_rules_owner_all"
  on public.category_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.category_rules to authenticated;
