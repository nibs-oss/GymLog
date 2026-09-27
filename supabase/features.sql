-- GymLog feature migration
-- Run AFTER repair.sql, in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Adds: muscle groups, bodyweight log, decimal weights (for kg/lbs), achievement de-duplication.

begin;

-- Weights are always stored in kg. Allow decimals so lbs converts cleanly.
alter table public.sets alter column weight type numeric using weight::numeric;

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

commit;

-- Make the API see the new columns/tables immediately
notify pgrst, 'reload schema';
