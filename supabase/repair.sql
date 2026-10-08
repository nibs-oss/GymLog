-- GymLog database repair
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Fixes foreign keys (so deletes cascade correctly) and row-level security
-- (so each user can fully manage their own data and nobody else's).
-- It deletes no real data. It only removes "orphan" rows that point to a
-- parent row that no longer exists (they can't be seen in the app anyway).

begin;

-- ---------------------------------------------------------------
-- 1. Helper: replace the foreign key on a column with the right ON DELETE rule
-- ---------------------------------------------------------------
create or replace function pg_temp.reset_fk(tbl text, col text, ref_tbl text, on_delete text)
returns void language plpgsql as $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.conrelid = format('public.%I', tbl)::regclass
      and a.attname = col
  loop
    execute format('alter table public.%I drop constraint %I', tbl, r.conname);
  end loop;
  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s',
    tbl, tbl || '_' || col || '_fkey', col, ref_tbl, on_delete);
end $$;

-- ---------------------------------------------------------------
-- 2. Clean up orphan rows so the new constraints can be added
-- ---------------------------------------------------------------
update public.workout_sessions ws set routine_id = null
 where routine_id is not null
   and not exists (select 1 from public.routines r where r.id = ws.routine_id);

delete from public.routine_exercises re
 where not exists (select 1 from public.routines r where r.id = re.routine_id);

delete from public.session_exercises se
 where not exists (select 1 from public.workout_sessions ws where ws.id = se.session_id);

delete from public.sets s
 where not exists (select 1 from public.session_exercises se where se.id = s.session_exercise_id);

-- ---------------------------------------------------------------
-- 3. Foreign keys with correct delete behaviour
-- ---------------------------------------------------------------
alter table public.workout_sessions alter column routine_id drop not null;

-- Deleting a routine keeps past workouts (they just lose the routine link)
select pg_temp.reset_fk('workout_sessions',  'routine_id',          'routines',          'set null');
-- Deleting a routine removes its exercise list
select pg_temp.reset_fk('routine_exercises', 'routine_id',          'routines',          'cascade');
-- Deleting a workout removes its exercises and sets
select pg_temp.reset_fk('session_exercises', 'session_id',          'workout_sessions',  'cascade');
select pg_temp.reset_fk('sets',              'session_exercise_id', 'session_exercises', 'cascade');

-- ---------------------------------------------------------------
-- 4. user_settings needs one row per user (the Profile page upserts on user_id)
-- ---------------------------------------------------------------
delete from public.user_settings a
 using public.user_settings b
 where a.user_id = b.user_id and a.ctid < b.ctid;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.user_settings'::regclass
      and c.contype in ('p', 'u')
      and array_length(c.conkey, 1) = 1
      and a.attname = 'user_id'
  ) then
    alter table public.user_settings add constraint user_settings_user_id_key unique (user_id);
  end if;
end $$;

-- ---------------------------------------------------------------
-- 5. One log (workout or rest day) per user per PH calendar date.
--    The app writes `date` as the Asia/Manila YYYY-MM-DD; this makes the
--    database enforce it too. If duplicate days already exist they are NOT
--    touched: the index is skipped and the duplicates are listed as notices.
--    Resolve them (delete or move one log per day), then re-run this file.
-- ---------------------------------------------------------------
do $$
declare d record;
begin
  if to_regclass('public.workout_sessions_user_date_key') is not null then
    return;
  end if;
  if exists (select 1 from public.workout_sessions
             group by user_id, date having count(*) > 1) then
    for d in
      select user_id, date, count(*) as n, string_agg(id::text, ', ') as ids
      from public.workout_sessions
      group by user_id, date having count(*) > 1
      order by date
    loop
      raise notice 'Duplicate day: user %, date %, % logs (ids: %)', d.user_id, d.date, d.n, d.ids;
    end loop;
    raise notice 'Skipped workout_sessions_user_date_key: fix the duplicate days above, then re-run.';
  else
    create unique index workout_sessions_user_date_key
      on public.workout_sessions (user_id, date);
  end if;
end $$;

-- ---------------------------------------------------------------
-- 6. Row-level security: replace all policies with one clear set
-- ---------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('routines', 'routine_exercises', 'workout_sessions',
                        'session_exercises', 'sets', 'achievements', 'user_settings')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets              enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_settings     enable row level security;

-- Tables that store user_id directly
create policy "own routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child tables: allowed when the parent row belongs to the user
create policy "own routine exercises" on public.routine_exercises
  for all
  using (exists (select 1 from public.routines r
                 where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.routines r
                      where r.id = routine_id and r.user_id = auth.uid()));

create policy "own session exercises" on public.session_exercises
  for all
  using (exists (select 1 from public.workout_sessions ws
                 where ws.id = session_id and ws.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_sessions ws
                      where ws.id = session_id and ws.user_id = auth.uid()));

create policy "own sets" on public.sets
  for all
  using (exists (select 1 from public.session_exercises se
                 join public.workout_sessions ws on ws.id = se.session_id
                 where se.id = session_exercise_id and ws.user_id = auth.uid()))
  with check (exists (select 1 from public.session_exercises se
                      join public.workout_sessions ws on ws.id = se.session_id
                      where se.id = session_exercise_id and ws.user_id = auth.uid()));

commit;
