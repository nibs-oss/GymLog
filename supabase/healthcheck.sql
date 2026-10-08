-- GymLog database health check
-- Run in Supabase dashboard -> SQL Editor AFTER repair.sql and features.sql.
--
-- It signs in "as" one of your users (so row-level security is really tested),
-- performs every write the app does, checks the results, then ROLLS EVERYTHING
-- BACK. No data is changed. The output is a table of PASS / FAIL rows.
-- A failed step undoes its own changes and clears its ids; tests that depend
-- on it report SKIP instead of failing for an unrelated reason.
--
-- To test a specific account, put its email here (otherwise the oldest user is used):
--   select set_config('healthcheck.email', 'you@example.com', false);

drop table if exists pg_temp.hc_results;
create temp table hc_results (n serial, status text, test text, detail text);

do $$
declare
  test_email text := nullif(current_setting('healthcheck.email', true), '');
  uid uuid;
  results text[] := '{}';
  -- ids are kept as text so this works whether the tables use uuid or bigint keys
  r1 text; r2 text; re1 text; re2 text; re3 text;
  s1 text; s2 text; se1 text; se2 text;
  n int; v numeric; t text;
  base date; -- test rows go before any real data (one log per day is enforced)
begin
  select id into uid from auth.users
   where test_email is null or email = test_email
   order by created_at limit 1;
  if uid is null then
    insert into hc_results(status, test, detail) values ('FAIL', 'find test user', 'no user found');
    return;
  end if;
  select least(current_date,
               (select min(date) from public.workout_sessions where user_id = uid),
               (select min(date) from public.body_weights where user_id = uid)) - 400
    into base;

  -- ---------------------------------------------------------------
  -- Part A: structure checks (as admin)
  -- ---------------------------------------------------------------
  for t, n in
    select x.tbl, (select count(*) from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                   where ns.nspname = 'public' and c.relname = x.tbl and c.relrowsecurity)::int
    from unnest(array['routines','routine_exercises','workout_sessions','session_exercises',
                      'sets','achievements','user_settings','body_weights']) as x(tbl)
  loop
    results := results || (case when n = 1 then 'PASS' else 'FAIL' end || '|RLS enabled: ' || t || '|');
  end loop;

  for t in
    select format('%s.%s -> %s', x.tbl, x.col, x.rule) || '|' ||
           coalesce((
             select case c.confdeltype when 'n' then 'set null' when 'c' then 'cascade'
                                       when 'a' then 'no action' when 'r' then 'restrict' else c.confdeltype::text end
             from pg_constraint c
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
             where c.contype = 'f' and c.conrelid = format('public.%I', x.tbl)::regclass and a.attname = x.col
             limit 1), 'missing')
    from (values ('workout_sessions','routine_id','set null'),
                 ('routine_exercises','routine_id','cascade'),
                 ('session_exercises','session_id','cascade'),
                 ('sets','session_exercise_id','cascade')) as x(tbl, col, rule)
  loop
    results := results || (case when split_part(t, '|', 2) = split_part(split_part(t, '|', 1), '-> ', 2)
                                then 'PASS' else 'FAIL' end
                           || '|On delete rule: ' || split_part(t, '|', 1) || '|actual: ' || split_part(t, '|', 2));
  end loop;

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name in ('routine_exercises','session_exercises') and column_name = 'muscle_group';
  results := results || (case when n = 2 then 'PASS' else 'FAIL' end || '|muscle_group columns exist|found ' || n || ' of 2');

  select data_type into t from information_schema.columns
   where table_schema = 'public' and table_name = 'sets' and column_name = 'weight';
  results := results || (case when t = 'numeric' then 'PASS' else 'FAIL' end || '|sets.weight allows decimals|type: ' || coalesce(t, 'missing'));

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'sets' and column_name in ('weight', 'reps') and is_nullable = 'YES';
  results := array_append(results, case when n = 2 then 'PASS' else 'FAIL' end
                                   || '|sets.weight / reps optional (bodyweight sets)|'
                                   || case when n = 2 then '' else 'run features.sql' end);

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'user_settings' and column_name = 'schedule';
  results := array_append(results, case when n = 1 then 'PASS|Weekly plan column exists|'
                                        else 'FAIL|Weekly plan column exists|run features.sql' end);

  results := results || (case when to_regclass('public.workout_sessions_user_date_key') is not null
                              then 'PASS|One log per day index exists|'
                              else 'FAIL|One log per day index exists|missing: run repair.sql (lists any duplicate days)' end);

  -- ---------------------------------------------------------------
  -- Part B: act as the user and do what the app does (rolled back)
  -- ---------------------------------------------------------------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', uid::text, true);
    execute 'set local role authenticated';

    -- 1. Create routine with exercises (routines/new)
    begin
      insert into public.routines (name, user_id) values ('HC Push Day', uid) returning id::text into r1;
      insert into public.routine_exercises (routine_id, name, muscle_group, position, default_sets, default_reps)
        values (r1::uuid, 'Bench Press', 'Chest', 1, 3, 8) returning id::text into re1;
      insert into public.routine_exercises (routine_id, name, muscle_group, position, default_sets, default_reps)
        values (r1::uuid, 'Overhead Press', 'Shoulders', 2, 3, 10) returning id::text into re2;
      results := array_append(results, 'PASS|Create routine + exercises|');
    exception when others then
      r1 := null; re1 := null; re2 := null;
      results := results || ('FAIL|Create routine + exercises|' || sqlerrm);
    end;

    -- 2. Edit routine: rename, update, add, remove exercise (routines/[id] edit)
    begin
      if r1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Create routine + exercises" failed';
      end if;
      update public.routines set name = 'HC Push Day v2' where id::text = r1;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'rename updated % rows', n; end if;
      update public.routine_exercises set default_reps = 6, position = 2 where id::text = re1;
      insert into public.routine_exercises (routine_id, name, position, default_sets, default_reps)
        values (r1::uuid, 'Dip', 3, 3, 12) returning id::text into re3;
      delete from public.routine_exercises where id::text = re2;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'delete exercise removed % rows', n; end if;
      results := array_append(results, 'PASS|Edit routine (rename/update/add/remove)|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Edit routine (rename/update/add/remove)|' || sqlerrm);
    when others then
      results := results || ('FAIL|Edit routine (rename/update/add/remove)|' || sqlerrm);
    end;

    -- 3. Duplicate routine
    begin
      if r1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Create routine + exercises" failed';
      end if;
      insert into public.routines (name, user_id) values ('HC Push Day (copy)', uid) returning id::text into r2;
      insert into public.routine_exercises (routine_id, name, muscle_group, position, default_sets, default_reps)
        select r2::uuid, name, muscle_group, position, default_sets, default_reps
          from public.routine_exercises where routine_id::text = r1;
      select count(*) into n from public.routine_exercises where routine_id::text = r2;
      if n <> 2 then raise exception 'copy has % exercises, expected 2', n; end if;
      results := array_append(results, 'PASS|Duplicate routine|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Duplicate routine|' || sqlerrm);
    when others then
      results := results || ('FAIL|Duplicate routine|' || sqlerrm);
    end;

    -- 4. Log a workout with decimal (lbs-converted) weights (log/[routineId])
    begin
      if r1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Create routine + exercises" failed';
      end if;
      insert into public.workout_sessions (user_id, routine_id, date, is_rest_day)
        values (uid, r1::uuid, base, false) returning id::text into s1;
      insert into public.session_exercises (session_id, name, muscle_group, position)
        values (s1::uuid, 'Bench Press', 'Chest', 1) returning id::text into se1;
      insert into public.session_exercises (session_id, name, muscle_group, position)
        values (s1::uuid, 'Dip', null, 2) returning id::text into se2;
      insert into public.sets (session_exercise_id, set_number, weight, reps) values
        (se1::uuid, 1, 45.359, 8), (se1::uuid, 2, 47.5, 6), (se2::uuid, 1, null, 12);
      select weight into v from public.sets where session_exercise_id::text = se1 and set_number = 1;
      if v <> 45.359 then raise exception 'weight stored as %', v; end if;
      results := array_append(results, 'PASS|Log workout (session, exercises, sets, decimal kg)|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Log workout (session, exercises, sets, decimal kg)|' || sqlerrm);
    when others then
      s1 := null; se1 := null; se2 := null;
      results := results || ('FAIL|Log workout (session, exercises, sets, decimal kg)|' || sqlerrm);
    end;

    -- 5. Edit a logged workout: change date, clear + re-insert exercises (history/[id])
    begin
      if s1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Log workout" failed';
      end if;
      update public.workout_sessions set date = base + 1 where id::text = s1;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'date update changed % rows (missing UPDATE policy?)', n; end if;
      delete from public.sets where session_exercise_id::text in (se1, se2);
      delete from public.session_exercises where session_id::text = s1;
      insert into public.session_exercises (session_id, name, position)
        values (s1::uuid, 'Bench Press', 1) returning id::text into se1;
      insert into public.sets (session_exercise_id, set_number, weight, reps) values (se1::uuid, 1, 50, 5);
      select count(*) into n from public.sets where session_exercise_id::text = se1;
      if n <> 1 then raise exception 'expected 1 set after edit, found %', n; end if;
      results := array_append(results, 'PASS|Edit logged workout (date + sets)|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Edit logged workout (date + sets)|' || sqlerrm);
    when others then
      results := results || ('FAIL|Edit logged workout (date + sets)|' || sqlerrm);
    end;

    -- 6. Delete a routine that has a logged workout: workout kept, link cleared
    begin
      if s1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Log workout" failed';
      end if;
      delete from public.routines where id::text = r1;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'deleted % routines', n; end if;
      select count(*) into n from public.workout_sessions where id::text = s1 and routine_id is null;
      if n <> 1 then raise exception 'workout was not kept with routine_id = null'; end if;
      select count(*) into n from public.routine_exercises where routine_id::text = r1;
      if n <> 0 then raise exception '% routine exercises left behind', n; end if;
      results := array_append(results, 'PASS|Delete routine used by a workout (history kept)|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Delete routine used by a workout (history kept)|' || sqlerrm);
    when others then
      results := results || ('FAIL|Delete routine used by a workout (history kept)|' || sqlerrm);
    end;

    -- 7. Delete a workout directly: exercises and sets cascade away
    begin
      if s1 is null then
        raise exception using errcode = 'HCSKP', message = 'skipped: "Log workout" failed';
      end if;
      delete from public.workout_sessions where id::text = s1;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'deleted % workouts', n; end if;
      select count(*) into n from public.sets where session_exercise_id::text = se1;
      if n <> 0 then raise exception '% sets left behind', n; end if;
      select count(*) into n from public.session_exercises where session_id::text = s1;
      if n <> 0 then raise exception '% exercises left behind', n; end if;
      results := array_append(results, 'PASS|Delete workout (exercises + sets removed)|');
    exception when sqlstate 'HCSKP' then
      results := array_append(results, 'SKIP|Delete workout (exercises + sets removed)|' || sqlerrm);
    when others then
      results := results || ('FAIL|Delete workout (exercises + sets removed)|' || sqlerrm);
    end;

    -- 8. Rest day (log/rest) and deleting it
    begin
      insert into public.workout_sessions (user_id, routine_id, date, is_rest_day)
        values (uid, null, base + 2, true) returning id::text into s2;
      begin
        insert into public.workout_sessions (user_id, routine_id, date, is_rest_day)
          values (uid, null, base + 2, false);
        raise exception 'second log on the same date was allowed (run repair.sql step 5)';
      exception when unique_violation then
        null; -- expected: one log per day
      end;
      delete from public.workout_sessions where id::text = s2;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'rest day delete removed % rows', n; end if;
      results := array_append(results, 'PASS|Log + delete rest day (one log per day)|');
    exception when others then
      results := results || ('FAIL|Log + delete rest day (one log per day)|' || sqlerrm);
    end;

    -- 8b. All-or-nothing workout save (save_workout from features.sql)
    begin
      s2 := public.save_workout(null, null, base + 3,
        '[{"name":"HC Squat","muscle_group":"Legs","sets":[{"weight":100.5,"reps":5},{"weight":null,"reps":8}]}]'::jsonb)::text;
      select count(*) into n from public.sets st
        join public.session_exercises se on se.id = st.session_exercise_id
       where se.session_id::text = s2;
      if n <> 2 then raise exception 'new workout has % sets, expected 2', n; end if;
      -- An edit that fails halfway must leave the saved workout untouched
      begin
        perform public.save_workout(s2::uuid, null, base + 3,
          '[{"name":"HC Squat","sets":[{"weight":"oops","reps":5}]}]'::jsonb);
        raise exception 'invalid weight was accepted';
      exception when invalid_text_representation then
        null; -- expected
      end;
      select count(*) into n from public.sets st
        join public.session_exercises se on se.id = st.session_exercise_id
       where se.session_id::text = s2;
      if n <> 2 then raise exception 'failed edit left % sets, expected the original 2', n; end if;
      delete from public.workout_sessions where id::text = s2;
      results := array_append(results, 'PASS|Save workout all-or-nothing (save_workout)|');
    exception when others then
      results := results || ('FAIL|Save workout all-or-nothing (save_workout)|' || sqlerrm);
    end;

    -- 9. Settings upsert (profile)
    begin
      insert into public.user_settings (user_id, units, weekly_goal, rest_day_reminders)
        values (uid, 'lbs', 5, true)
        on conflict (user_id) do update set units = excluded.units, weekly_goal = excluded.weekly_goal,
                                            rest_day_reminders = excluded.rest_day_reminders;
      select count(*) into n from public.user_settings where user_id = uid and units = 'lbs' and weekly_goal = 5;
      if n <> 1 then raise exception 'found % matching settings rows', n; end if;
      results := array_append(results, 'PASS|Save profile settings (one row per user)|');
    exception when others then
      results := results || ('FAIL|Save profile settings (one row per user)|' || sqlerrm);
    end;

    -- 10. Achievements: earning twice keeps one row
    begin
      insert into public.achievements (user_id, type, earned_at) values (uid, 'hc_test', now())
        on conflict (user_id, type) do nothing;
      insert into public.achievements (user_id, type, earned_at) values (uid, 'hc_test', now())
        on conflict (user_id, type) do nothing;
      select count(*) into n from public.achievements where user_id = uid and type = 'hc_test';
      if n <> 1 then raise exception 'found % rows', n; end if;
      results := array_append(results, 'PASS|Award achievement (no duplicates)|');
    exception when others then
      results := results || ('FAIL|Award achievement (no duplicates)|' || sqlerrm);
    end;

    -- 11. Bodyweight: save, overwrite same day, delete
    begin
      insert into public.body_weights (user_id, date, weight) values (uid, base, 70.5)
        on conflict (user_id, date) do update set weight = excluded.weight;
      insert into public.body_weights (user_id, date, weight) values (uid, base, 71.2)
        on conflict (user_id, date) do update set weight = excluded.weight;
      select weight into v from public.body_weights where user_id = uid and date = base;
      if v <> 71.2 then raise exception 'weight is %', v; end if;
      delete from public.body_weights where user_id = uid and date = base;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'delete removed % rows', n; end if;
      results := array_append(results, 'PASS|Bodyweight save / overwrite / delete|');
    exception when others then
      results := results || ('FAIL|Bodyweight save / overwrite / delete|' || sqlerrm);
    end;

    -- 12. Security: cannot write rows for someone else
    begin
      insert into public.routines (name, user_id) values ('HC intruder', gen_random_uuid());
      results := array_append(results, 'FAIL|Blocked: create routine for another user|insert was allowed!');
    exception when others then
      results := results || ('PASS|Blocked: create routine for another user|' || sqlstate);
    end;

    begin
      insert into public.routine_exercises (routine_id, name, position, default_sets, default_reps)
        select id, 'HC intruder', 99, 1, 1 from public.routines where user_id <> uid limit 1;
      get diagnostics n = row_count;
      results := results || (case when n = 0 then 'PASS' else 'FAIL' end
                             || '|Blocked: add exercise to another user''s routine|' || n || ' rows');
    exception when others then
      results := results || ('PASS|Blocked: add exercise to another user''s routine|' || sqlstate);
    end;

    -- 13. Security: other users' rows are invisible
    begin
      select (select count(*) from public.routines where user_id <> uid)
           + (select count(*) from public.workout_sessions where user_id <> uid)
           + (select count(*) from public.body_weights where user_id <> uid) into n;
      results := results || (case when n = 0 then 'PASS' else 'FAIL' end
                             || '|Other users'' data is hidden|' || n || ' foreign rows visible');
    exception when others then
      results := results || ('FAIL|Other users'' data is hidden|' || sqlerrm);
    end;

    -- Undo everything above
    raise exception 'hc_rollback';
  exception when others then
    if sqlerrm <> 'hc_rollback' then
      results := results || ('FAIL|Health check aborted|' || sqlerrm);
    end if;
  end;

  execute 'reset role';
  insert into hc_results(status, test, detail)
    select split_part(x, '|', 1), split_part(x, '|', 2), nullif(split_part(x, '|', 3), '')
    from unnest(results) with ordinality as u(x, ord) order by ord;
  insert into hc_results(status, test, detail)
    values ('INFO', 'Tested as user', (select email from auth.users where id = uid));
end $$;

select status, test, detail from hc_results
 order by (status = 'FAIL') desc, (status = 'SKIP') desc, n;
