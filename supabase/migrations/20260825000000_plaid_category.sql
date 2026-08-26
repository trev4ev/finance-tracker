alter table public.transactions
  add column if not exists plaid_category text;

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
    (new.id, 'Other', 'expense', '#64748b');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres, supabase_auth_admin;
