-- Plaid sync updates last_synced_at (and used to also rewrite name with the bank
-- product nickname). Keep the user-facing label so edits survive a reload/sync.

create or replace function public.preserve_account_name_on_sync()
returns trigger
language plpgsql
as $$
begin
  if new.last_synced_at is distinct from old.last_synced_at then
    new.name := old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_preserve_name_on_sync on public.accounts;

create trigger accounts_preserve_name_on_sync
  before update on public.accounts
  for each row execute function public.preserve_account_name_on_sync();

alter function public.preserve_account_name_on_sync() set search_path = public;

revoke all on function public.preserve_account_name_on_sync() from public, anon, authenticated;
