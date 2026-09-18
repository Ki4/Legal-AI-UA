-- Verification scenarios for 20260918130000_service_pauses.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_service_pauses.sql
--
-- What is claimed and tried here: a pause is a row with a reason (§5.7). The
-- reason decides who may open it and who may close it; the version's status
-- follows the row and never moves on its own; the fix going on sale closes the
-- pause; an order on a version known to be wrong is delivered out of review
-- or not at all.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'accountable@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'signatory@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'stranger@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'reviewer@test.local');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000a2', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin'),
  ('00000000-0000-0000-0000-0000000000a4', 'lawyer'),
  ('00000000-0000-0000-0000-0000000000a5', 'lawyer');

update public.profiles set role = 'lawyer', full_name = 'Accountable Lawyer'
where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'lawyer', full_name = 'Head of Labour'
where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'lawyer', full_name = 'Unrelated Lawyer'
where id = '00000000-0000-0000-0000-0000000000a4';
update public.profiles set role = 'lawyer', full_name = 'Order Reviewer'
where id = '00000000-0000-0000-0000-0000000000a5';

insert into public.practice_area_signatories (practice_area, lawyer_id, is_head) values
  ('labour', '00000000-0000-0000-0000-0000000000a2', true);

insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000b1', 'dismissal', 'Dismissal appeal', 'labour');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', true);

-- v1 is on sale; v2 is the fix, released and waiting for an admin; v3 a draft.
insert into public.service_versions
  (id, service_id, version, status, generation_mode, review_mode, released_at, released_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 1,
   'in_review', 'template', 'auto', now(), '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 2,
   'in_review', 'template', 'auto', now(), '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b1', 3,
   'draft', 'template', 'auto', null, null);

update public.service_versions set status = 'published'
where id = '00000000-0000-0000-0000-0000000000c1';

-- A client with an order in flight on v1, in `auto` mode, so it could be
-- delivered without a lawyer — until the version is known to be wrong.
insert into public.clients (id) values ('00000000-0000-0000-0000-0000000000d1');
insert into public.entitlements (id, client_id, kind) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'one_off');
insert into public.entitlement_services (entitlement_id, service_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1');
insert into public.orders (id, client_id, service_version_id, entitlement_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1');
update public.orders set status = 'submitted' where id = '00000000-0000-0000-0000-0000000000f1';
update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-0000000000f1';

-- Shape ---------------------------------------------------------------------

do $$
declare
  v_status public.service_status;
begin
  set local role postgres;

  ------------------------------------------- 1. a status flip is not a pause
  begin
    update public.service_versions set status = 'paused'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 1. the status moved to paused with no row behind it';
  exception when others then
    raise notice 'PASS 1. a pause is a row: %', sqlerrm;
  end;

  ------------------------------------------- 2. only a version on sale
  begin
    insert into public.service_pauses (service_version_id, reason)
    values ('00000000-0000-0000-0000-0000000000c3', 'defect');
    raise notice 'FAIL 2. a draft was paused';
  exception when others then
    raise notice 'PASS 2. a draft is not on sale, so it has nothing to pause: %', sqlerrm;
  end;

  ------------------------------------------- 3. a row pauses the version
  insert into public.service_pauses (id, service_version_id, reason, note)
  values ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000c1',
          'defect', 'Article reference in clause 4 is to the repealed code.');
  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 3. opening a pause takes the version off sale (%)',
    case when v_status = 'paused' then 'PASS' else 'FAIL' end, v_status;

  ------------------------------------------- 4. one open pause per version
  begin
    insert into public.service_pauses (service_version_id, reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'commercial');
    raise notice 'FAIL 4. a second open pause was accepted';
  exception when unique_violation then
    raise notice 'PASS 4. one open pause per version; the first reason stands';
  end;

  ------------------------------------------- 5. a closed pause names its resolution
  begin
    update public.service_pauses set closed_at = now()
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 5. closed with no resolution';
  exception when check_violation then
    raise notice 'PASS 5. a pause closes with a resolution or not at all';
  end;

  ------------------------------------------- 6. new_version names the version
  begin
    update public.service_pauses set closed_at = now(), resolution = 'new_version'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 6. new_version with nothing named';
  exception when check_violation then
    raise notice 'PASS 6. new_version says which one';
  end;

  ------------------------------------------- 7. the opening is on the record
  begin
    update public.service_pauses set reason = 'commercial'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 7. the reason was rewritten';
  exception when others then
    raise notice 'PASS 7. why it was opened does not change: %', sqlerrm;
  end;

  ------------------------------------------- 8. the version cannot slip out from under it
  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 8. a version with an open pause went back on sale by status';
  exception when others then
    raise notice 'PASS 8. the status follows the row, not the other way: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Orders in flight --------------------------------------------------------------

do $$
begin
  set local role postgres;

  ------------------------------------------- 9. auto delivery is refused
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'FAIL 9. an auto order on a defective version was delivered unreviewed';
  exception when others then
    raise notice 'PASS 9. nothing leaves a version known to be wrong on autopilot: %', sqlerrm;
  end;

  ------------------------------------------- 10. out of review, by a named reviewer, it goes
  update public.orders
  set status = 'in_review', reviewer_id = '00000000-0000-0000-0000-0000000000a5'
  where id = '00000000-0000-0000-0000-0000000000f1';
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-0000000000f1';
    raise notice 'PASS 10. reviewed, it is delivered';
  exception when others then
    raise notice 'FAIL 10. a reviewed order was refused: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Who closes ------------------------------------------------------------------------

do $$
declare
  v_status public.service_status;
  v_res public.pause_resolution;
  v_replaced uuid;
begin
  set local role authenticated;

  ------------------------------------------- 11. an admin does not lift a defect
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"admin"}}';
  begin
    update public.service_pauses set closed_at = now(), resolution = 'resumed'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 11. an admin lifted a professional pause';
  exception when others then
    raise notice 'PASS 11. starting is not the admin''s: %', sqlerrm;
  end;

  ------------------------------------------- 12. nor the accountable lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';
  begin
    update public.service_pauses set closed_at = now(), resolution = 'resumed'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 12. the accountable lawyer lifted the pause on their own service';
  exception when others then
    raise notice 'PASS 12. the accountable lawyer may stop, not start: %', sqlerrm;
  end;

  ------------------------------------------- 13. nobody closes it as new_version by hand
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"lawyer"}}';
  begin
    update public.service_pauses
    set closed_at = now(), resolution = 'new_version', replaced_by = '00000000-0000-0000-0000-0000000000c2'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 13. new_version was written by hand';
  exception when others then
    raise notice 'PASS 13. new_version is the fix going on sale, not a value to type: %', sqlerrm;
  end;

  ------------------------------------------- 14. the fix going on sale closes it
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"admin"}}';
  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-0000000000c2';
  select resolution, replaced_by into v_res, v_replaced from public.service_pauses
  where id = '00000000-0000-0000-0000-00000000aa01';
  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 14. publishing the fix closed the pause as new_version naming it, and archived v1 (%, %, %)',
    case when v_res = 'new_version' and v_replaced = '00000000-0000-0000-0000-0000000000c2'
      and v_status = 'archived' then 'PASS' else 'FAIL' end, v_res, v_replaced, v_status;

  ------------------------------------------- 15. and a closed pause is history
  begin
    update public.service_pauses set note = 'edited after the fact'
    where id = '00000000-0000-0000-0000-00000000aa01';
    raise notice 'FAIL 15. a closed pause was edited';
  exception when others then
    raise notice 'PASS 15. closed is closed: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Who opens ---------------------------------------------------------------------------

do $$
declare
  v_status public.service_status;
begin
  set local role authenticated;

  ------------------------------------------- 16. an unrelated lawyer does not
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.service_pauses (service_version_id, reason)
    values ('00000000-0000-0000-0000-0000000000c2', 'defect');
    raise notice 'FAIL 16. a lawyer with no stake paused a service';
  exception when others then
    raise notice 'PASS 16. stopping is for the accountable: %', sqlerrm;
  end;

  ------------------------------------------- 17. a lawyer does not pause commercially
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.service_pauses (service_version_id, reason)
    values ('00000000-0000-0000-0000-0000000000c2', 'commercial');
    raise notice 'FAIL 17. a signatory opened a commercial pause';
  exception when others then
    raise notice 'PASS 17. a commercial pause is the admin''s decision: %', sqlerrm;
  end;

  ------------------------------------------- 18. the accountable lawyer stops it
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.service_pauses (id, service_version_id, reason, note)
    values ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000c2',
            'no_reviewer', 'Away until Monday, no cover arranged.');
    raise notice 'PASS 18. the accountable lawyer pauses without waiting for an admin';
  exception when others then
    raise notice 'FAIL 18. the accountable lawyer could not pause: %', sqlerrm;
  end;

  ------------------------------------------- 19. the signatory starts it again
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"lawyer"}}';
  update public.service_pauses set closed_at = now(), resolution = 'resumed'
  where id = '00000000-0000-0000-0000-00000000aa02';
  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000000c2';
  raise notice '% 19. a signatory closes it as resumed and the version is back on sale (%)',
    case when v_status = 'published' then 'PASS' else 'FAIL' end, v_status;

  ------------------------------------------- 20. a commercial pause is the admin's both ways
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"admin"}}';
  insert into public.service_pauses (id, service_version_id, reason)
  values ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-0000000000c2', 'commercial');
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"lawyer"}}';
  begin
    update public.service_pauses set closed_at = now(), resolution = 'resumed'
    where id = '00000000-0000-0000-0000-00000000aa03';
    raise notice 'FAIL 20. a signatory lifted a commercial pause';
  exception when others then
    raise notice 'PASS 20. a commercial pause is not a signatory''s to lift: %', sqlerrm;
  end;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"admin"}}';
  update public.service_pauses set closed_at = now(), resolution = 'resumed'
  where id = '00000000-0000-0000-0000-00000000aa03';
  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000000c2';
  raise notice '% 21. the admin lifts their own commercial pause (%)',
    case when v_status = 'published' then 'PASS' else 'FAIL' end, v_status;

  ------------------------------------------- 22. a false alarm does not taint the version
  raise notice '% 22. a version whose pauses all resumed is not known to be wrong',
    case when not public.version_known_wrong ('00000000-0000-0000-0000-0000000000c2')
      then 'PASS' else 'FAIL' end;

  ------------------------------------------- 23. nobody deletes a pause
  begin
    delete from public.service_pauses where id = '00000000-0000-0000-0000-00000000aa03';
    raise notice 'FAIL 23. an admin deleted a pause';
  exception when insufficient_privilege then
    raise notice 'PASS 23. a pause is history the moment it opens';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Audit -------------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------------------------- 24. the pause is in the per-service cut
  select count(*) into n from public.audit_events
  where entity_table = 'service_pauses'
    and service_id = '00000000-0000-0000-0000-0000000000b1'
    and (after ->> 'reason') = 'defect';
  raise notice '% 24. opening a defect pause is an audit row on the service (%)',
    case when n >= 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
