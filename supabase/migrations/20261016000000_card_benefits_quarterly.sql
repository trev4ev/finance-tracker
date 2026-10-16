-- Allow quarterly statement credits (e.g. Hilton Honors Surpass $50/quarter).

alter table public.card_benefits
  drop constraint if exists card_benefits_frequency_check;

alter table public.card_benefits
  add constraint card_benefits_frequency_check
  check (frequency in ('monthly', 'quarterly', 'semiannual', 'annual'));
