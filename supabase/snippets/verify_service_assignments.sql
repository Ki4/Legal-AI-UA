-- Verification scenarios for 20260811160000_service_assignments.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_service_assignments.sql

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'primary@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'cover@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'stranger@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'pending@test.local');

update public.profiles set role = 'lawyer', full_name = 'Primary Lawyer'
where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'lawyer', full_name = 'Cover Lawyer'
where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'lawyer', full_name = 'Unrelated Lawyer'
where id = '00000000-0000-0000-0000-0000000000a4';
-- a5 keeps role = null: registered, not yet approved.

insert into public.services (id, slug, title) values
  ('00000000-0000-0000-0000-0000000000b1', 'divorce', 'Divorce petition'),
  ('00000000-0000-0000-0000-0000000000b2', 'orphan', 'Nobody assigned');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', true);

-- Shape ---------------------------------------------------------------------

do $$
begin
  ------------------------------------------- 1. exactly one primary per service
  begin
    insert into public.service_assignments (service_id, lawyer_id, is_primary)
    values ('00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000a3', true);
    raise notice 'FAIL 1. a second primary was accepted';
  exception when unique_violation then
    raise notice 'PASS 1. only one lawyer can be accountable for a service';
  end;

  ------------------------------------------ 2. cover alongside is fine
  begin
    insert into public.service_assignments (service_id, lawyer_id, is_primary)
    values ('00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000a3', false);
    raise notice 'PASS 2. cover can be added alongside the primary';
  exception when others then
    raise notice 'FAIL 2. cover rejected: %', sqlerrm;
  end;

  ------------------------------- 3. publishing needs a primary, not just cover
  insert into public.service_versions (id, service_id, version, generation_mode, review_mode)
  values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000b2', 1,
          'template', 'auto');
  insert into public.service_assignments (service_id, lawyer_id, is_primary)
  values ('00000000-0000-0000-0000-0000000000b2',
          '00000000-0000-0000-0000-0000000000a3', false);
  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000c9';
    raise notice 'FAIL 3. published a service that has only cover';
  exception when others then
    raise notice 'PASS 3. cover is not enough to publish against: %', sqlerrm;
  end;
end;
$$;

-- Rights ---------------------------------------------------------------------

do $$
declare
  n integer;
  who uuid;
begin
  set local role authenticated;

  --------------------------- 4. cover carries the same rights as the primary
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'covered_field', 'Added by cover', 'text');
    raise notice 'PASS 4. cover may act on the service — which is the point of it';
  exception when others then
    raise notice 'FAIL 4. cover was blocked: %', sqlerrm;
  end;

  ----------------------------------- 5. an unrelated lawyer still cannot
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'intruder', 'Intruder', 'text');
    raise notice 'FAIL 5. an unassigned lawyer wrote to the service';
  exception when insufficient_privilege then
    raise notice 'PASS 5. an unassigned lawyer is still shut out';
  end;

  -------------------------- 6. the primary arranges their own cover
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.service_assignments (service_id, lawyer_id, is_primary)
    values ('00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000a4', false);
    raise notice 'PASS 6. the accountable lawyer can add cover without an admin';
  exception when others then
    raise notice 'FAIL 6. the primary could not add cover: %', sqlerrm;
  end;

  ------------------ 7. ...but cannot hand accountability to somebody else
  begin
    insert into public.service_assignments (service_id, lawyer_id, is_primary)
    values ('00000000-0000-0000-0000-0000000000b2',
            '00000000-0000-0000-0000-0000000000a1', true);
    raise notice 'FAIL 7. a lawyer made themselves accountable for a service';
  exception when insufficient_privilege then
    raise notice 'PASS 7. becoming the accountable lawyer is not self-service';
  end;

  begin
    perform public.set_primary_lawyer('00000000-0000-0000-0000-0000000000b1',
                                      '00000000-0000-0000-0000-0000000000a4');
    raise notice 'FAIL 7b. a lawyer moved accountability through the RPC';
  exception when others then
    raise notice 'PASS 7b. the RPC refuses a non-admin: %', sqlerrm;
  end;

  ------------------------------------ 8. cover cannot recruit further cover
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.service_assignments (service_id, lawyer_id, is_primary)
    values ('00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000a5', false);
    raise notice 'FAIL 8. cover added more cover';
  exception when insufficient_privilege then
    raise notice 'PASS 8. only the accountable lawyer arranges cover';
  end;

  ------------------------------------------ 9. the admin moves accountability
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';
  perform public.set_primary_lawyer('00000000-0000-0000-0000-0000000000b1',
                                    '00000000-0000-0000-0000-0000000000a3');

  set local role postgres;
  select lawyer_id into who from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1' and is_primary;
  select count(*) into n from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1' and is_primary;

  raise notice '% 9. accountability moved, and exactly one holder remains (% primary)',
    case when who = '00000000-0000-0000-0000-0000000000a3' and n = 1 then 'PASS' else 'FAIL' end, n;

  select count(*) into n from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and lawyer_id = '00000000-0000-0000-0000-0000000000a1';
  raise notice '% 9b. the previous holder stays on as cover rather than vanishing',
    case when n = 1 then 'PASS' else 'FAIL' end;
end;
$$;

-- Detaching cover ------------------------------------------------------------
--
-- Added with ADM-10, when the console gained a screen that deletes these rows.
-- Everything above tests who may *add* an assignment, and a DELETE is the half
-- that fails quietly: the USING clause filters the row out, the statement
-- matches nothing, and the client receives an empty array with no error. Only
-- the affected-row count can tell the difference, which is why every scenario
-- here reads ROW_COUNT rather than trusting that no exception was raised.
--
-- State on entry: b1's accountable lawyer is a3 (moved in scenario 9), with a1
-- and a4 attached as cover.

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------- 12. cover cannot detach another cover lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","app_metadata":{"role":"lawyer"}}';
  delete from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and lawyer_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  raise notice '% 12. cover cannot detach a colleague — silently, % rows',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ----------------------------- 13. the accountable lawyer detaches their cover
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"lawyer"}}';
  delete from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and lawyer_id = '00000000-0000-0000-0000-0000000000a4';
  get diagnostics n = row_count;
  raise notice '% 13. the accountable lawyer removes cover (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------ 14. ...and cannot drop their own accountability
  -- The policy requires `not is_primary` on both sides, so this deletes
  -- nothing. Accountability is moved with set_primary_lawyer, never dropped: a
  -- service with nobody answering for it is the state the table exists to
  -- prevent (spec §13).
  delete from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and lawyer_id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics n = row_count;
  raise notice '% 14. the accountable lawyer cannot delete their own row (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------- 14b. an admin can, and the console does not
  -- Recorded rather than fixed. `service_assignments_write_admin` covers every
  -- row, so an admin deleting the accountable one is permitted by the schema —
  -- what keeps the console from doing it is the `is_primary = false` filter in
  -- `removeCover`, not a policy. Closing it needs a migration, which is Tier 2
  -- and a decision of its own; noting it here is what stops it being rediscovered.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';
  delete from public.service_assignments
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and lawyer_id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics n = row_count;
  raise notice '% 14b. an admin can detach the accountable lawyer (% rows) — app-level filter only',
    case when n = 1 then 'PASS' else 'FAIL' end, n;
end;
$$;

-- The staff directory --------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","app_metadata":{"role":"lawyer"}}';

  select count(*) into n from public.profiles
  where id = '00000000-0000-0000-0000-0000000000a1';
  raise notice '% 10. a lawyer can read a colleague''s name (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  select count(*) into n from public.profiles
  where id = '00000000-0000-0000-0000-0000000000a5';
  raise notice '% 10b. a pending registration is not a colleague (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;
end;
$$;

-- Audit ----------------------------------------------------------------------

do $$
declare
  n integer;
begin
  -- Read as postgres, deliberately. The question here is whether the trigger
  -- *wrote* the events, not who may read them — that is scenario 4's job and
  -- `verify_audit_events.sql`'s. Without this line the block inherits whatever
  -- session the previous block left behind, and it did: it passed only because
  -- the lawyer still set from scenario 10 happened to be assigned to b1, so
  -- detaching them in scenario 13 turned this green check red while the log was
  -- working perfectly. A scenario that depends on the order of the ones before
  -- it is measuring the script, not the schema.
  set local role postgres;

  select count(*) into n from public.audit_events
  where entity_table = 'service_assignments'
    and service_id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 11. assignment changes are on the record (% events)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;
end;
$$;

rollback;
