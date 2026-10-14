-- Per-user notification settings. Phone is used for unused-credit SMS reminders.
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  credit_reminders boolean not null default true,
  last_credit_reminder_on date,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_owner_all"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.user_settings to authenticated;
