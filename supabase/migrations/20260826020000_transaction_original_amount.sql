alter table public.transactions
  add column if not exists original_amount numeric(14, 2);

update public.transactions
set original_amount = amount
where original_amount is null;

alter table public.transactions
  alter column original_amount set not null;

alter table public.transactions
  drop constraint if exists transactions_original_amount_check;

alter table public.transactions
  add constraint transactions_original_amount_check check (original_amount >= 0);
