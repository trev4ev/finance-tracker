insert into public.categories (user_id, name, kind, color)
select distinct c.user_id, v.name, v.kind, v.color
from public.categories c
cross join (
  values
    ('Investments', 'expense', '#38bdf8'),
    ('Transfers', 'expense', '#94a3b8')
) as v(name, kind, color)
on conflict (user_id, name, kind) do nothing;

update public.transactions as t
set
  type = 'transfer',
  category_id = c.id,
  plaid_category = coalesce(t.plaid_category, 'INVESTMENT_AND_RETIREMENT_FUNDS')
from public.categories as c
where c.user_id = t.user_id
  and c.name = 'Investments'
  and c.kind = 'expense'
  and t.category_id is null
  and lower(coalesce(t.merchant_name, '') || ' ' || coalesce(t.description, ''))
    ~ 'robinhood|vanguard|fidelity|schwab|betterment|wealthfront|coinbase|e-?trade|acorns';

update public.transactions as t
set
  type = 'transfer',
  category_id = c.id,
  plaid_category = coalesce(t.plaid_category, 'TRANSFER_OUT')
from public.categories as c
where c.user_id = t.user_id
  and c.name = 'Transfers'
  and c.kind = 'expense'
  and t.category_id is null
  and (
    t.type = 'transfer'
    or coalesce(t.plaid_category, '') in (
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'LOAN_PAYMENTS'
    )
    or lower(coalesce(t.merchant_name, '') || ' ' || coalesce(t.description, ''))
      ~ 'credit crd|crcardpmt|citi autopay|ach pmt|autopay payment|withdrwl|withdrawal|(^|[^a-z])atm([^a-z]|$)|(^|[^a-z])venmo([^a-z]|$)|(^|[^a-z])zelle([^a-z]|$)|payment - thank you'
  );

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
    (new.id, 'Other income', 'income', '#86efac'),
    (new.id, 'Rent', 'expense', '#fb7185'),
    (new.id, 'Groceries', 'expense', '#fbbf24'),
    (new.id, 'Dining', 'expense', '#f97316'),
    (new.id, 'Transport', 'expense', '#38bdf8'),
    (new.id, 'Travel', 'expense', '#22d3ee'),
    (new.id, 'Utilities', 'expense', '#818cf8'),
    (new.id, 'Fees', 'expense', '#94a3b8'),
    (new.id, 'Subscriptions', 'expense', '#c084fc'),
    (new.id, 'Services', 'expense', '#a78bfa'),
    (new.id, 'Healthcare', 'expense', '#2dd4bf'),
    (new.id, 'Personal care', 'expense', '#5eead4'),
    (new.id, 'Shopping', 'expense', '#f472b6'),
    (new.id, 'Entertainment', 'expense', '#a3e635'),
    (new.id, 'Home', 'expense', '#d97706'),
    (new.id, 'Taxes & giving', 'expense', '#e11d48'),
    (new.id, 'Investments', 'expense', '#38bdf8'),
    (new.id, 'Transfers', 'expense', '#94a3b8'),
    (new.id, 'Other', 'expense', '#64748b');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;
