-- GymLog feature migration
-- Run AFTER repair.sql, in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Adds: muscle groups, bodyweight log, decimal weights (for kg/lbs), optional weight/reps per set,
--       achievement de-duplication, all-or-nothing workout saving (save_workout),
--       weekly plan (user_settings.schedule), strength standards (user_settings.sex).

begin;

-- Weights are always stored in kg. Allow decimals so lbs converts cleanly.
alter table public.sets alter column weight type numeric using weight::numeric;

-- A set may have no weight (bodyweight moves like dips) or no reps, but not
-- neither. Empty means "not recorded", which the app already shows and
-- totals that way; storing 0 instead would show up as a real 0 kg set.
alter table public.sets alter column weight drop not null;
alter table public.sets alter column reps drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.sets'::regclass and conname = 'sets_weight_or_reps') then
    alter table public.sets
      add constraint sets_weight_or_reps check (weight is not null or reps is not null);
  end if;
end $$;

-- Weekly plan (Routines page): weekday "0" (Sun) … "6" (Sat) -> routine id or "rest"
alter table public.user_settings add column if not exists schedule jsonb not null default '{}'::jsonb;

-- Which strength standards to use (Progress > Strength level); empty until chosen
alter table public.user_settings add column if not exists sex text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_settings_sex_check') then
    alter table public.user_settings add constraint user_settings_sex_check check (sex in ('male', 'female'));
  end if;
end $$;

-- Muscle group per exercise (routine template + logged copy)
alter table public.routine_exercises add column if not exists muscle_group text;
alter table public.session_exercises add column if not exists muscle_group text;

-- Bodyweight log (kg)
create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight numeric not null check (weight > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_weights enable row level security;
drop policy if exists "own body weights" on public.body_weights;
create policy "own body weights" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Each achievement can be earned once per user
delete from public.achievements a
 using public.achievements b
 where a.user_id = b.user_id and a.type = b.type and a.ctid < b.ctid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.achievements'::regclass
      and conname = 'achievements_user_id_type_key'
  ) then
    alter table public.achievements
      add constraint achievements_user_id_type_key unique (user_id, type);
  end if;
end $$;

-- Save a workout (session + exercises + sets) in one transaction, so a dropped
-- connection can't leave a half-saved workout. p_session_id null = log a new
-- workout; otherwise replace that workout's date, exercises and sets.
-- p_exercises: [{ "name", "muscle_group", "sets": [{ "weight", "reps" }] }]
-- Runs as the calling user, so row-level security still applies.
create or replace function public.save_workout(
  p_session_id uuid,
  p_routine_id uuid,
  p_date date,
  p_exercises jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  sid uuid := p_session_id;
  ex jsonb;
  st jsonb;
  ex_id uuid;
  ex_pos int := 0;
  set_no int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Days are Philippine calendar dates (see lib/fitness.ts)
  if p_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'A workout can''t be dated in the future.';
  end if;

  if sid is null then
    insert into workout_sessions (user_id, routine_id, date, is_rest_day)
    values (auth.uid(), p_routine_id, p_date, false)
    returning id into sid;
  else
    update workout_sessions set date = p_date where id = sid and user_id = auth.uid();
    if not found then
      raise exception 'Workout not found';
    end if;
    delete from sets where session_exercise_id in (select id from session_exercises where session_id = sid);
    delete from session_exercises where session_id = sid;
  end if;

  for ex in select * from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    ex_pos := ex_pos + 1;
    insert into session_exercises (session_id, name, muscle_group, position)
    values (sid, ex->>'name', nullif(ex->>'muscle_group', ''), ex_pos)
    returning id into ex_id;

    set_no := 0;
    for st in select * from jsonb_array_elements(coalesce(ex->'sets', '[]'::jsonb))
    loop
      set_no := set_no + 1;
      insert into sets (session_exercise_id, set_number, weight, reps)
      values (ex_id, set_no, (st->>'weight')::numeric, (st->>'reps')::numeric);
    end loop;
  end loop;

  return sid;
end $$;

revoke execute on function public.save_workout(uuid, uuid, date, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, uuid, date, jsonb) to authenticated;

commit;

-- Make the API see the new columns/tables immediately
notify pgrst, 'reload schema';
