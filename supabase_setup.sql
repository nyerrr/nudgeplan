-- Run this in Supabase SQL Editor if you haven't already done step 3
-- (Steps 1 and 2 already done according to user)

-- Step 3: Auto-create a profile on sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Step 4: store the optional calendar deadline alongside each task.
alter table if exists public.tasks
  add column if not exists due_date text;

-- Step 5: Row Level Security. The anon key is public, so every table that
-- holds user data must enforce ownership in the database. The policies below
-- are idempotent: safe to re-run after a schema change.
alter table if exists public.profiles enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.steps enable row level security;
alter table if exists public.history enable row level security;
alter table if exists public.daily_stats enable row level security;
alter table if exists public.checkins enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all"
  on public.tasks
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "steps_owner_all" on public.steps;
create policy "steps_owner_all"
  on public.steps
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tasks t
      where t.id = steps.task_id
        and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "history_owner_all" on public.history;
create policy "history_owner_all"
  on public.history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_stats_owner_all" on public.daily_stats;
create policy "daily_stats_owner_all"
  on public.daily_stats
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "checkins_owner_all" on public.checkins;
create policy "checkins_owner_all"
  on public.checkins
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Helpful for the ownership filters; not required for security.
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists steps_user_id_idx on public.steps (user_id);
create index if not exists steps_task_id_idx on public.steps (task_id);
create index if not exists history_user_created_idx on public.history (user_id, created_at desc);
create index if not exists daily_stats_user_date_idx on public.daily_stats (user_id, date desc);
create index if not exists checkins_user_created_idx on public.checkins (user_id, created_at desc);
