-- Verification scenarios for 20260814120000_approve_user_grants_only.sql and
-- 20260917120000_user_roles_and_token_hook.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_approve_user.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Three things these scenarios are built around, two of them learned here:
--
--   * The fixtures write `user_roles` and not only `profiles.role`. The table
--     is what the function reads and what the token hook mints a JWT from; a
--     fixture that set only the mirror would make every scenario below pass
--     against a function that reads the wrong place. Before ADR-0026 the same
--     sentence was true of `raw_app_meta_data`, and scenario 13 is what keeps a
--     value left there from ever reaching a token again.
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
  ('00000000-0000-0000-0000-0000000000d1', 'approver@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d2', 'second-admin@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d3', 'lawyer@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d4', 'pending@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d5', 'pending-two@test.local', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000000d6', 'drifted@test.local', '{}'::jsonb),
  -- d7 carries the pre-ADR-0026 shape: a role in the jsonb and no row in the
  -- table. The backfill removed every such key on the day the migration ran;
  -- this user is what one would look like if it came back.
  ('00000000-0000-0000-0000-0000000000d7', 'stale-json@test.local', '{"role":"admin"}'::jsonb);

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'admin'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin'),
  ('00000000-0000-0000-0000-0000000000d3', 'lawyer');

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
  v_held text;
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
  select r.role into v_held
  from public.user_roles r where r.user_id = '00000000-0000-0000-0000-0000000000d4';
  select p.role into v_mirror
  from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000d4';
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 3. approving a pending user raised: %', v_failed;
  elsif v_held = 'lawyer' and v_mirror = 'lawyer' then
    raise notice 'PASS 3. the role reached both the authority and the mirror';
  else
    raise notice 'FAIL 3. user_roles=% profile=%', v_held, v_mirror;
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

-- The hole ADR-0018 closed --------------------------------------------------

do $$
declare
  v_held text;
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
  select r.role into v_held
  from public.user_roles r where r.user_id = '00000000-0000-0000-0000-0000000000d3';
  select p.role into v_mirror
  from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000d3';
  set local role authenticated;

  if v_held = 'lawyer' and v_mirror = 'lawyer' then
    raise notice 'PASS 5b. and nothing was written before it refused';
  else
    raise notice 'FAIL 5b. the refusal still moved something: user_roles=% profile=%', v_held, v_mirror;
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
  select r.role into v_held
  from public.user_roles r where r.user_id = '00000000-0000-0000-0000-0000000000d1';
  set local role authenticated;

  if v_held = 'admin' then
    raise notice 'PASS 7b. the caller still holds the role they called with';
  else
    raise notice 'FAIL 7b. the caller is now %', v_held;
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
  v_held text;
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
  select r.role into v_held
  from public.user_roles r where r.user_id = '00000000-0000-0000-0000-0000000000d4';
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 9. a double-click raised: %', v_failed;
  elsif v_held = 'lawyer' then
    raise notice 'PASS 9. a repeated approval is silent and leaves the role where it was';
  else
    raise notice 'FAIL 9. the repeat changed the role to %', v_held;
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
  select r.role into v_held
  from public.user_roles r where r.user_id = '00000000-0000-0000-0000-0000000000d6';

  ------------------------------- 11. the mirror follows for everyone approved
  select count(*) into v_rows
  from public.profiles p
  left join public.user_roles r on r.user_id = p.id
  where p.id in ('00000000-0000-0000-0000-0000000000d4',
                 '00000000-0000-0000-0000-0000000000d6')
    and p.role is distinct from r.role;
  set local role authenticated;

  if v_failed is not null then
    raise notice 'FAIL 10. approving a drifted user raised: %', v_failed;
  elsif v_held = 'lawyer' then
    raise notice 'PASS 10. a profile-only role is repaired rather than treated as held';
  else
    raise notice 'FAIL 10. the authority still says %', v_held;
  end if;

  if v_rows = 0 then
    raise notice 'PASS 11. no approved user is left with a mirror that disagrees';
  else
    raise notice 'FAIL 11. % approved user(s) have a profile disagreeing with user_roles', v_rows;
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The token hook (ADR-0026) ---------------------------------------------------
--
-- GoTrue calls it as `supabase_auth_admin` with the claims it is about to sign.
-- The event below is the documented shape, trimmed to the keys that matter.
--
-- Run as `postgres`, not as the auth admin: `postgres` may not `set role` to
-- it here. What the auth admin *may* do is asserted from the ACL instead
-- (scenario 15b), and the only proof that GoTrue actually mints the claim is a
-- sign-in against the running stack — `supabase/README.md` says how.

do $$
declare
  v_out jsonb;
begin
  set local role postgres;
  set local request.jwt.claims = '{}';

  ------------------------------------ 12. a held role is stamped into the claim
  v_out := public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000d3","claims":{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{"provider":"email"},"role":"authenticated"}}'::jsonb);

  if v_out -> 'claims' -> 'app_metadata' ->> 'role' = 'lawyer'
     and v_out -> 'claims' -> 'app_metadata' ->> 'provider' = 'email'
     and v_out -> 'claims' ->> 'role' = 'authenticated' then
    raise notice 'PASS 12. the hook stamps app_metadata.role from user_roles and leaves the rest of the claims alone';
  else
    raise notice 'FAIL 12. hook returned %', v_out;
  end if;

  ------------------------- 13. a role that is not held cannot reach the token
  -- d7 has "admin" in the jsonb GoTrue builds app_metadata from, and no row in
  -- the table. If the hook only *added* a claim, the stale value would go out
  -- signed.
  v_out := public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000d7","claims":{"sub":"00000000-0000-0000-0000-0000000000d7","app_metadata":{"provider":"email","role":"admin"}}}'::jsonb);

  if v_out -> 'claims' -> 'app_metadata' ? 'role' then
    raise notice 'FAIL 13. a role nobody granted reached the token: %', v_out -> 'claims' -> 'app_metadata';
  else
    raise notice 'PASS 13. a role in the jsonb and not in the table is removed from the claim';
  end if;

  ------------------------------------ 14. a pending user gets no role at all
  v_out := public.custom_access_token_hook(
    '{"user_id":"00000000-0000-0000-0000-0000000000d5","claims":{"sub":"00000000-0000-0000-0000-0000000000d5","app_metadata":{"provider":"email"}}}'::jsonb);

  if v_out -> 'claims' -> 'app_metadata' ? 'role' then
    raise notice 'FAIL 14. a pending user was minted a role';
  else
    raise notice 'PASS 14. a user holding nothing is minted nothing';
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';

  ------------------------------------- 15. nobody but the auth server calls it
  -- An admin could otherwise ask "what would my token say" — harmless — or
  -- anyone could probe which user ids hold which role, which is not.
  begin
    perform public.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-0000000000d3","claims":{}}'::jsonb);
    raise notice 'FAIL 15. authenticated may execute the token hook';
  exception when insufficient_privilege then
    raise notice 'PASS 15. the hook is not executable by authenticated';
  end;

  ------------------------------- 15b. ...and is executable by the auth server
  -- Read from the ACL, because this session cannot become supabase_auth_admin.
  -- Three things have to hold for a token to be minted at all: execute on the
  -- hook, select on the table, and a policy that lets the select see rows.
  set local role postgres;
  if has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute')
     and has_table_privilege('supabase_auth_admin', 'public.user_roles', 'select')
     and exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'user_roles'
                   and 'supabase_auth_admin' = any (roles) and cmd = 'SELECT') then
    raise notice 'PASS 15b. supabase_auth_admin may execute the hook, read user_roles, and has a policy that shows it rows';
  else
    raise notice 'FAIL 15b. the auth server is missing a privilege it needs to mint a role: execute=% select=%',
      has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
      has_table_privilege('supabase_auth_admin', 'public.user_roles', 'select');
  end if;
  set local role authenticated;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The table itself --------------------------------------------------------------

do $$
declare
  v_rows integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';

  --------------------------- 16. a grant leaves an audit row naming the granter
  -- The row ADR-0018 recorded as missing. d4 was approved in scenario 3 by d1.
  set local role postgres;
  select count(*) into v_rows
  from public.audit_events e
  where e.entity_table = 'user_roles'
    and e.entity_id = '00000000-0000-0000-0000-0000000000d4'
    and e.action = 'insert'
    and e.actor_id = '00000000-0000-0000-0000-0000000000d1'
    and e.actor_role = 'admin'
    and e.after ->> 'role' = 'lawyer';
  set local role authenticated;

  if v_rows = 1 then
    raise notice 'PASS 16. approving writes one audit row: who, as what, made whom which';
  else
    raise notice 'FAIL 16. expected one audit row for the grant, found %', v_rows;
  end if;

  ------------------------------- 17. an admin cannot write the table directly
  -- No grant, so this is a permission error rather than a policy filtering the
  -- row out. Writes go through approve_user and, later, ADM-33's RPC.
  begin
    insert into public.user_roles (user_id, role)
    values ('00000000-0000-0000-0000-0000000000d5', 'admin');
    raise notice 'FAIL 17. an admin inserted a user_roles row directly';
  exception when insufficient_privilege then
    raise notice 'PASS 17. user_roles has no insert grant for authenticated';
  end;

  -------------------------------------------- 18. an admin reads every row
  select count(*) into v_rows from public.user_roles;
  if v_rows >= 5 then
    raise notice 'PASS 18. an admin reads the whole held set (% rows)', v_rows;
  else
    raise notice 'FAIL 18. an admin sees only % row(s)', v_rows;
  end if;

  ---------------------------------------- 19. a lawyer reads only their own
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{"role":"lawyer"}}';
  select count(*) into v_rows from public.user_roles;
  if v_rows = 1 then
    raise notice 'PASS 19. a lawyer sees their own row and nobody else''s';
  else
    raise notice 'FAIL 19. a lawyer sees % row(s)', v_rows;
  end if;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
begin
  set local role postgres;

  ---------------------------------- 20. phase 1: one held role per person
  -- The hook picks "the one row" without an active_role to consult, so the
  -- schema has to make that a fact. Phase 2 drops the constraint on purpose.
  begin
    insert into public.user_roles (user_id, role)
    values ('00000000-0000-0000-0000-0000000000d3', 'admin');
    raise notice 'FAIL 20. a second held role was accepted before phase 2';
  exception when unique_violation then
    raise notice 'PASS 20. a second held role is refused while the hook has no active role to read';
  end;

  ------------------------------------------- 21. only the two known roles
  begin
    insert into public.user_roles (user_id, role)
    values ('00000000-0000-0000-0000-0000000000d5', 'superadmin');
    raise notice 'FAIL 21. an unknown role was stored';
  exception when check_violation then
    raise notice 'PASS 21. a role that is not admin or lawyer is refused by the table';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
