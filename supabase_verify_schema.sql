-- Run this in the Supabase SQL Editor to check that your tables and columns
-- match what NudgePlan reads and writes. It is read-only: it only SELECTs from
-- information_schema, so it cannot change your data.
--
-- Query 1 lists every required column and marks it ok / MISSING.
-- Any MISSING row is a problem: fetchRemoteState() throws if even one of its
-- six queries fails, which makes the app fall back to local-only storage.
--
-- Query 2 dumps the actual column types so they can be compared with the
-- expectations below. The important ones:
--   profiles.id, *.user_id  -> uuid      (RLS compares them to auth.uid())
--   tasks.id, steps.id      -> text      (app-generated IDs like tm1abc2...)
--   steps.task_id           -> text      (must match tasks.id for the FK)
--   tasks.due_date          -> text/date (plain YYYY-MM-DD, never timestamptz)
--   tasks.position, steps.position -> int (used by ORDER BY)

-- 1. Required columns. Look for any row where status = 'MISSING'.
with required(tbl, col) as (
  values
    ('profiles','id'), ('profiles','name'), ('profiles','start_h'), ('profiles','end_h'),
    ('profiles','energy'), ('profiles','nudges'), ('profiles','nudge_lead_min'),
    ('profiles','theme'), ('profiles','onboarded'), ('profiles','updated_at'),
    ('tasks','id'), ('tasks','user_id'), ('tasks','title'), ('tasks','dur'),
    ('tasks','effort'), ('tasks','day'), ('tasks','pri'), ('tasks','start'),
    ('tasks','fixed'), ('tasks','done'), ('tasks','due_date'), ('tasks','position'),
    ('tasks','completed_at'), ('tasks','updated_at'),
    ('steps','id'), ('steps','task_id'), ('steps','user_id'), ('steps','text'),
    ('steps','min'), ('steps','done'), ('steps','position'), ('steps','updated_at'),
    ('history','id'), ('history','user_id'), ('history','created_at'),
    ('daily_stats','id'), ('daily_stats','user_id'), ('daily_stats','date'),
    ('checkins','id'), ('checkins','user_id'), ('checkins','created_at')
)
select
  r.tbl,
  r.col,
  coalesce(c.data_type, 'MISSING') as data_type,
  case when c.data_type is null then 'MISSING' else 'ok' end as status
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.tbl
 and c.column_name = r.col
order by r.tbl, r.col;

-- 2. Full dump of the six tables' actual columns and types.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'tasks',
    'steps',
    'history',
    'daily_stats',
    'checkins'
  )
order by table_name, ordinal_position;

-- 3. Foreign key and RLS check. After running supabase_fix_schema.sql and the
--    updated supabase_setup.sql you want steps_task_fks = 1, and every table
--    below with relrowsecurity = true, relforcerowsecurity = true, and
--    policies > 0.
select
  (select count(*)
   from pg_constraint
   where conrelid = 'public.steps'::regclass
     and confrelid = 'public.tasks'::regclass
     and contype = 'f') as steps_task_fks,
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  count(p.polname) as policies
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'profiles',
    'tasks',
    'steps',
    'history',
    'daily_stats',
    'checkins'
  )
group by c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;
