-- Fixes the two schema problems found by supabase_verify_schema.sql.
-- Run this in the Supabase SQL Editor, then run the updated supabase_setup.sql,
-- then re-run supabase_verify_schema.sql to confirm no MISSING rows.
--
-- Read the comments before running: the ID conversions rewrite those columns
-- and their indexes. Existing rows are preserved (UUID values become text).

-- 1. A foreign key blocks an ALTER COLUMN TYPE. Drop every FK on
--    steps.task_id -> tasks.id, whatever its name.
do $$
declare
  con name;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.steps'::regclass
      and c.confrelid = 'public.tasks'::regclass
      and a.attname = 'task_id'
      and c.contype = 'f'
  loop
    execute format('alter table public.steps drop constraint %I', con);
  end loop;
end $$;

-- 2. Remove UUID defaults. The app always supplies its own IDs.
alter table public.tasks alter column id drop default;
alter table public.steps alter column id drop default;

-- 3. App-generated IDs ("tm...", "sm...") are text, not UUIDs.
alter table public.tasks
  alter column id type text using id::text;

alter table public.steps
  alter column id type text using id::text,
  alter column task_id type text using task_id::text;

-- 4. Restore the cascade FK now that both sides are text.
alter table public.steps
  add constraint steps_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete cascade;

-- 5. The deadline column used by Upcoming was missing on your tasks table.
alter table public.tasks
  add column if not exists due_date text;

-- 6. Optional but recommended: make audit columns fill themselves in so
--    future direct SQL inserts do not leave them NULL.
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();
alter table public.tasks alter column created_at set default now();
alter table public.tasks alter column updated_at set default now();
alter table public.steps alter column created_at set default now();
alter table public.steps alter column updated_at set default now();
alter table public.history alter column created_at set default now();
alter table public.checkins alter column created_at set default now();
