-- Supabase schema for QQ淇's biweekly internship progress records.
-- Run this file from the Supabase SQL editor or as a migration.

create extension if not exists pgcrypto with schema extensions;

-- Keep the single-user allowlist outside the API-exposed public schema. The
-- actual email address is inserted privately in the Supabase SQL editor and is
-- intentionally never committed to this repository.
create schema if not exists private;

create table if not exists private.allowed_users (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint allowed_users_email_not_blank
    check (length(btrim(email)) > 0)
);

create or replace function private.current_user_is_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select exists (
    select 1
    from private.allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all privileges on schema private from public;
revoke all privileges on schema private from anon;
revoke all privileges on schema private from authenticated;
grant usage on schema private to authenticated;

revoke all privileges on table private.allowed_users from public;
revoke all privileges on table private.allowed_users from anon;
revoke all privileges on table private.allowed_users from authenticated;

revoke all privileges on function private.current_user_is_allowed()
  from public;
revoke all privileges on function private.current_user_is_allowed()
  from anon;
revoke all privileges on function private.current_user_is_allowed()
  from authenticated;
grant execute on function private.current_user_is_allowed()
  to authenticated;

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

-- These columns were introduced after the first deployment. Keeping them in
-- ALTER statements makes this file safe to apply to both fresh and existing
-- projects.
alter table if exists public.progress_entries
  add column if not exists stage_key text;

alter table if exists public.progress_entries
  add column if not exists roadmap_task_keys text[]
    not null default '{}'::text[];

alter table if exists public.progress_entries
  add column if not exists attachments jsonb
    not null default '[]'::jsonb;

update public.progress_entries
set roadmap_task_keys = '{}'::text[]
where roadmap_task_keys is null;

alter table if exists public.progress_entries
  alter column roadmap_task_keys set default '{}'::text[],
  alter column roadmap_task_keys set not null;

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
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can create their own progress entries"
  on public.progress_entries;
create policy "Users can create their own progress entries"
  on public.progress_entries
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can update their own progress entries"
  on public.progress_entries;
create policy "Users can update their own progress entries"
  on public.progress_entries
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can delete their own progress entries"
  on public.progress_entries;
create policy "Users can delete their own progress entries"
  on public.progress_entries
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

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

-- Roadmap tasks turn the long-term learning plan into user-owned, trackable
-- work items. Stable task keys let the frontend seed tasks idempotently.
create table if not exists public.learning_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  task_key text not null,
  stage_key text not null,
  category text not null,
  title text not null,
  detail text not null,
  target_start date,
  target_end date,
  cadence text not null,
  priority smallint not null default 3,
  status text not null default '未开始',
  evidence_link text,
  evidence_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_tasks_user_task_key_unique
    unique (user_id, task_key),
  constraint learning_tasks_valid_target_range
    check (
      target_start is null
      or target_end is null
      or target_end >= target_start
    ),
  constraint learning_tasks_valid_priority
    check (priority between 1 and 5),
  constraint learning_tasks_valid_status
    check (status in ('未开始', '进行中', '已完成'))
);

alter table if exists public.learning_tasks
  add column if not exists evidence_note text;

create index if not exists learning_tasks_user_stage_schedule_idx
  on public.learning_tasks (user_id, stage_key, target_start, priority);

create or replace function public.set_learning_tasks_updated_at()
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

drop trigger if exists set_learning_tasks_updated_at
  on public.learning_tasks;

create trigger set_learning_tasks_updated_at
before update on public.learning_tasks
for each row
execute function public.set_learning_tasks_updated_at();

alter table public.learning_tasks enable row level security;
alter table public.learning_tasks force row level security;

drop policy if exists "Users can read their own learning tasks"
  on public.learning_tasks;
create policy "Users can read their own learning tasks"
  on public.learning_tasks
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can create their own learning tasks"
  on public.learning_tasks;
create policy "Users can create their own learning tasks"
  on public.learning_tasks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can update their own learning tasks"
  on public.learning_tasks;
create policy "Users can update their own learning tasks"
  on public.learning_tasks
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can delete their own learning tasks"
  on public.learning_tasks;
create policy "Users can delete their own learning tasks"
  on public.learning_tasks
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.current_user_is_allowed())
  );

revoke all privileges on table public.learning_tasks from public;
revoke all privileges on table public.learning_tasks from anon;
revoke all privileges on table public.learning_tasks from authenticated;
grant select, insert, update, delete
  on table public.learning_tasks to authenticated;

revoke all privileges on function public.set_learning_tasks_updated_at()
  from public;
revoke all privileges on function public.set_learning_tasks_updated_at()
  from anon;
revoke all privileges on function public.set_learning_tasks_updated_at()
  from authenticated;

-- One durable row per study day makes elapsed time and streaks truthful instead
-- of inferring them from task status changes.
create table if not exists public.daily_study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  log_date date not null,
  minutes integer not null,
  subject text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_study_logs_user_date_unique unique (user_id, log_date),
  constraint daily_study_logs_valid_minutes check (minutes between 1 and 1440),
  constraint daily_study_logs_subject_not_blank check (length(btrim(subject)) > 0)
);

create index if not exists daily_study_logs_user_date_idx
  on public.daily_study_logs (user_id, log_date desc);

create or replace function public.set_daily_study_logs_updated_at()
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

drop trigger if exists set_daily_study_logs_updated_at
  on public.daily_study_logs;

create trigger set_daily_study_logs_updated_at
before update on public.daily_study_logs
for each row
execute function public.set_daily_study_logs_updated_at();

alter table public.daily_study_logs enable row level security;
alter table public.daily_study_logs force row level security;

drop policy if exists "Users can read their own daily study logs"
  on public.daily_study_logs;
create policy "Users can read their own daily study logs"
  on public.daily_study_logs for select to authenticated
  using ((select auth.uid()) = user_id and (select private.current_user_is_allowed()));

drop policy if exists "Users can create their own daily study logs"
  on public.daily_study_logs;
create policy "Users can create their own daily study logs"
  on public.daily_study_logs for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.current_user_is_allowed()));

drop policy if exists "Users can update their own daily study logs"
  on public.daily_study_logs;
create policy "Users can update their own daily study logs"
  on public.daily_study_logs for update to authenticated
  using ((select auth.uid()) = user_id and (select private.current_user_is_allowed()))
  with check ((select auth.uid()) = user_id and (select private.current_user_is_allowed()));

drop policy if exists "Users can delete their own daily study logs"
  on public.daily_study_logs;
create policy "Users can delete their own daily study logs"
  on public.daily_study_logs for delete to authenticated
  using ((select auth.uid()) = user_id and (select private.current_user_is_allowed()));

revoke all privileges on table public.daily_study_logs from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_study_logs to authenticated;
revoke all privileges on function public.set_daily_study_logs_updated_at()
  from public, anon, authenticated;

-- Private file bucket. The first path segment is always the authenticated user
-- id, so storage policies can isolate files without exposing permanent URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qqqi-uploads',
  'qqqi-uploads',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
    'text/plain', 'text/markdown', 'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own growth files" on storage.objects;
create policy "Users can upload their own growth files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'qqqi-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can read their own growth files" on storage.objects;
create policy "Users can read their own growth files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'qqqi-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.current_user_is_allowed())
  );

drop policy if exists "Users can delete their own growth files" on storage.objects;
create policy "Users can delete their own growth files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'qqqi-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.current_user_is_allowed())
  );
