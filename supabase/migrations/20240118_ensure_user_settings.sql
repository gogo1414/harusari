-- Ensure defaults are set even if table exists
alter table public.user_settings alter column cycle_start_day set default 1;
alter table public.user_settings alter column week_start set default 'sunday';

-- Enable RLS (idempotent)
alter table public.user_settings enable row level security;

-- Re-create policies to ensure access
drop policy if exists "Users can view their own settings" on public.user_settings;
create policy "Users can view their own settings"
  on public.user_settings for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  using ( auth.uid() = user_id );
