-- Explicit review flag. Existing rows default to reviewed so the inbox is
-- not a historical dump. New Plaid imports set reviewed = false.
alter table public.transactions
  add column reviewed boolean not null default true;
