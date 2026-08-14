-- Verification scenarios for 20260814120000_approve_user_grants_only.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_approve_user.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Three things these scenarios are built around, two of them learned here:
--
--   * The fixtures set `raw_app_meta_data` and not only `profiles.role`. The
--     app_metadata is what the function reads and what a JWT is minted from; a
--     fixture that set only the mirror would make every scenario below pass
--     against a function that reads the wrong column.
--   * **Reading `auth.users` is not something `authenticated` may do.** The
--     first version of this script called the RPC and then checked the result
--     from the same role, and three scenarios reported FAIL for a function that
--     had worked perfectly — the denial was the assertion, not the thing under
--     test. Every read below switches to `postgres` explicitly and switches
--     back, which is also why a `set local role` appears in the middle of a
--     block rather than only at the top.
--   * Scenarios 5-8 check the state *after* a refusal, not only that it raised.
--     A guard that raises after writing is a guard that logs its own bypass.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'approver@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d2', 'second-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d3', 'lawyer@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d4', 'pending@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d5', 'pending-two@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d6', 'drifted@test.local', '{}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Approver'
where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin', full_name = 'Second Admin'
where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set role = 'lawyer', full_name = 'A Lawyer'
where id = '00000000-0000-0000-0000-0000000000d3';
-- d4 and d5 keep role = null: registered, not yet approved.
--
-- d6 is the drift case: the mirror says lawyer, the authority says nothing. A
-- user in this state cannot do anything at all, because rights come from the
-- JWT — so approving them has to be allowed and has to repair it.
update public.profiles set role = 'lawyer', full_name = 'Mirror Drift'
where id = '00000000-0000-0000-0000-0000000000d6';

-- Who may call it -------------------------------------------------------------

do $$
begin
  set local role authenticated;

  ------------------------------------------------- 1. a lawyer cannot approve
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{"role":"lawyer"}}';
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d4', 'lawyer');
    raise notice 'FAIL 1. a lawyer approved a registration';
  exception when others then
    raise notice 'PASS 1. a lawyer cannot approve: %', sqlerrm;
  end;

  ----------------------------- 2. a pending user cannot approve themselves
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","app_metadata":{}}';
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d4', 'admin');
    raise notice 'FAIL 2. a pending user made themselves an admin';
  exception when others then
    raise notice 'PASS 2. a user with no role cannot approve anybody, themselves included';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- What it does ----------------------------------------------------------------

do $$
declare
  v_meta text;
  v_mirror text;
  v_failed text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';

  -------------------------------------------- 3. an admin grants a first role
  v_failed := null;
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d4', 'lawyer');
  exception when others then
    v_failed := sqlerrm;
  end;

  -- Out of the caller's role to read the authority, and straight back into it.
  set local role postgres;
  select u.raw_app_meta_data ->> 'role' into v_meta
  from auth.users u where u.id = '00000000-0000-0000-0000-0000000000d4';
  select p.role into v_mirror
  from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000d4';
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 3. approving a pending user raised: %', v_failed;
  elsif v_meta = 'lawyer' and v_mirror = 'lawyer' then
    raise notice 'PASS 3. the role reached both the authority and the mirror';
  else
    raise notice 'FAIL 3. app_metadata=% profile=%', v_meta, v_mirror;
  end if;

  ------------------------------------------------------- 4. an invalid role
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d5', 'superuser');
    raise notice 'FAIL 4. an unknown role was accepted';
  exception when others then
    raise notice 'PASS 4. an unknown role is refused: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The hole this migration closes ----------------------------------------------

do $$
declare
  v_meta text;
  v_mirror text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';

  ------------------------------ 5. a lawyer cannot be promoted through approval
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d3', 'admin');
    raise notice 'FAIL 5. approve_user promoted a lawyer to admin';
  exception when others then
    raise notice 'PASS 5. approving someone who already has a role is refused: %', sqlerrm;
  end;

  set local role postgres;
  select u.raw_app_meta_data ->> 'role' into v_meta
  from auth.users u where u.id = '00000000-0000-0000-0000-0000000000d3';
  select p.role into v_mirror
  from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000d3';
  set local role authenticated;

  if v_meta = 'lawyer' and v_mirror = 'lawyer' then
    raise notice 'PASS 5b. and nothing was written before it refused';
  else
    raise notice 'FAIL 5b. the refusal still moved something: app_metadata=% profile=%', v_meta, v_mirror;
  end if;

  -------------------------- 6. an admin cannot be demoted through approval
  -- The direction that locks everybody out: the second admin, then the last one.
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d2', 'lawyer');
    raise notice 'FAIL 6. approve_user demoted an admin';
  exception when others then
    raise notice 'PASS 6. an admin cannot be demoted through the approval RPC';
  end;

  --------------------------------------- 7. ...including the caller themselves
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d1', 'lawyer');
    raise notice 'FAIL 7. an admin demoted themselves and locked the door behind them';
  exception when others then
    raise notice 'PASS 7. self-demotion goes through the same refusal';
  end;

  set local role postgres;
  select u.raw_app_meta_data ->> 'role' into v_meta
  from auth.users u where u.id = '00000000-0000-0000-0000-0000000000d1';
  set local role authenticated;

  if v_meta = 'admin' then
    raise notice 'PASS 7b. the caller still holds the role they called with';
  else
    raise notice 'FAIL 7b. the caller is now %', v_meta;
  end if;

  ------------------------------------------------- 8. a user who does not exist
  begin
    perform public.approve_user('00000000-0000-0000-0000-00000000dead', 'lawyer');
    raise notice 'FAIL 8. approving a nonexistent user reported success';
  exception when others then
    raise notice 'PASS 8. a target that does not exist is an error, not a silent no-op: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The two cases that must still work ------------------------------------------

do $$
declare
  v_meta text;
  v_rows integer;
  v_failed text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';

  ----------------------- 9. re-approving with the same role is a silent no-op
  -- d4 was approved as a lawyer in scenario 3. A second click must not raise.
  v_failed := null;
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d4', 'lawyer');
  exception when others then
    v_failed := sqlerrm;
  end;

  set local role postgres;
  select u.raw_app_meta_data ->> 'role' into v_meta
  from auth.users u where u.id = '00000000-0000-0000-0000-0000000000d4';
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 9. a double-click raised: %', v_failed;
  elsif v_meta = 'lawyer' then
    raise notice 'PASS 9. a repeated approval is silent and leaves the role where it was';
  else
    raise notice 'FAIL 9. the repeat changed the role to %', v_meta;
  end if;

  ------------------------------------------------ 10. mirror drift is repaired
  -- d6's profile says lawyer while the JWT would carry no role at all. Refusing
  -- here would leave a user nobody can fix through the console.
  v_failed := null;
  begin
    perform public.approve_user('00000000-0000-0000-0000-0000000000d6', 'lawyer');
  exception when others then
    v_failed := sqlerrm;
  end;

  set local role postgres;
  select u.raw_app_meta_data ->> 'role' into v_meta
  from auth.users u where u.id = '00000000-0000-0000-0000-0000000000d6';

  ------------------------------- 11. the mirror follows for everyone approved
  select count(*) into v_rows
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id in ('00000000-0000-0000-0000-0000000000d4',
                 '00000000-0000-0000-0000-0000000000d6')
    and p.role is distinct from (u.raw_app_meta_data ->> 'role');
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 10. approving a drifted user raised: %', v_failed;
  elsif v_meta = 'lawyer' then
    raise notice 'PASS 10. a profile-only role is repaired rather than treated as held';
  else
    raise notice 'FAIL 10. the authority still says %', v_meta;
  end if;

  if v_rows = 0 then
    raise notice 'PASS 11. no approved user is left with a mirror that disagrees';
  else
    raise notice 'FAIL 11. % approved user(s) have a profile disagreeing with app_metadata', v_rows;
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
