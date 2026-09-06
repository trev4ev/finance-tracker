-- Init-plan friendly RLS for the new benefit tables.

drop policy if exists "card_benefits_owner_all" on public.card_benefits;
create policy "card_benefits_owner_all"
  on public.card_benefits for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "benefit_redemptions_owner_all" on public.benefit_redemptions;
create policy "benefit_redemptions_owner_all"
  on public.benefit_redemptions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
