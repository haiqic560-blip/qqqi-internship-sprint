-- Supabase schema for QQ淇's biweekly internship progress records.
-- Run this file from the Supabase SQL editor or as a migration.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  period text not null,
  period_start date not null,
  period_end date not null,
  work text not null,
  link text,
  review text not null,
  status text not null default '进行中',
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint progress_entries_valid_period
    check (period_end >= period_start),
  constraint progress_entries_valid_status
    check (status in ('进行中', '已完成'))
);

create index if not exists progress_entries_user_period_idx
  on public.progress_entries (user_id, period_start desc, created_at desc);

create or replace function public.set_progress_entries_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_progress_entries_updated_at
  on public.progress_entries;

create trigger set_progress_entries_updated_at
before update on public.progress_entries
for each row
execute function public.set_progress_entries_updated_at();

alter table public.progress_entries enable row level security;
alter table public.progress_entries force row level security;

drop policy if exists "Users can read their own progress entries"
  on public.progress_entries;
create policy "Users can read their own progress entries"
  on public.progress_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own progress entries"
  on public.progress_entries;
create policy "Users can create their own progress entries"
  on public.progress_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own progress entries"
  on public.progress_entries;
create policy "Users can update their own progress entries"
  on public.progress_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own progress entries"
  on public.progress_entries;
create policy "Users can delete their own progress entries"
  on public.progress_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase grants table privileges separately from RLS. Anonymous clients receive
-- no table privilege; authenticated clients still have to pass the policies above.
revoke all privileges on table public.progress_entries from public;
revoke all privileges on table public.progress_entries from anon;
revoke all privileges on table public.progress_entries from authenticated;
grant select, insert, update, delete
  on table public.progress_entries to authenticated;

-- The trigger can execute without exposing its function as an RPC endpoint.
revoke all privileges on function public.set_progress_entries_updated_at()
  from public;
revoke all privileges on function public.set_progress_entries_updated_at()
  from anon;
revoke all privileges on function public.set_progress_entries_updated_at()
  from authenticated;
