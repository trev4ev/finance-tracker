-- Track credits that have been spent but have not posted yet.
alter table public.benefit_redemptions
  add column if not exists status text not null default 'used';

alter table public.benefit_redemptions
  drop constraint if exists benefit_redemptions_status_check;

alter table public.benefit_redemptions
  add constraint benefit_redemptions_status_check
  check (status in ('used', 'in_progress'));
