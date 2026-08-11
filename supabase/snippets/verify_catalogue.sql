-- Verification scenarios for 20260811120000_catalogue_services.sql.
-- Each check prints PASS or FAIL; nothing is left behind (rolled back at the end).

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'lawyer@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@test.local');

update public.profiles set role = 'lawyer' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-0000000000a2';

insert into public.services (id, slug, title, assigned_lawyer_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'divorce', 'Divorce petition',
   '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', 'orphan', 'Service with no lawyer', null);

insert into public.service_versions (id, service_id, version, generation_mode, review_mode) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 1,
   'template', 'auto'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 2,
   'template', 'lawyer_required');

insert into public.service_version_prices values
  ('00000000-0000-0000-0000-0000000000c1', 'UAH', 550000);

do $$
declare
  ok boolean;
  msg text;
begin
  ------------------------------------------------------------------ 1. publish
  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-0000000000c1';

  select published_at is not null
     and published_by is null -- auth.uid() is null outside a request
  into ok from public.service_versions where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 1. publishing stamps published_at', case when ok then 'PASS' else 'FAIL' end;

  --------------------------------------------------- 2. content is now frozen
  begin
    update public.service_versions set review_mode = 'lawyer_required'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 2. frozen content accepted an edit';
  exception when others then
    raise notice 'PASS 2. frozen content rejected: %', sqlerrm;
  end;

  ------------------------------------------- 3. lifecycle may still move (pause)
  begin
    update public.service_versions set status = 'paused'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'PASS 3. status may still move after publication';
  exception when others then
    raise notice 'FAIL 3. pause was rejected: %', sqlerrm;
  end;

  --------------------------------------------------- 4. prices frozen with it
  begin
    update public.service_version_prices set amount_minor = 1
    where service_version_id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 4. price of a published version was edited';
  exception when others then
    raise notice 'PASS 4. price freeze held: %', sqlerrm;
  end;

  ------------------------------------------------ 5. published cannot be deleted
  begin
    delete from public.service_versions where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 5. published version was deleted';
  exception when others then
    raise notice 'PASS 5. delete refused: %', sqlerrm;
  end;

  ------------------------------------ 6. publishing v2 archives the live slot
  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-0000000000c2';

  select status = 'archived' into ok
  from public.service_versions where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 6. predecessor archived on publish (paused counted as live)',
    case when ok then 'PASS' else 'FAIL' end;

  select count(*) = 1 into ok
  from public.service_versions
  where service_id = '00000000-0000-0000-0000-0000000000b1'
    and status in ('published', 'paused');
  raise notice '% 6b. exactly one live version remains',
    case when ok then 'PASS' else 'FAIL' end;

  ------------------------------------- 7. cannot publish without a lawyer
  insert into public.service_versions (id, service_id, version, generation_mode, review_mode)
  values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 1,
          'template', 'auto');
  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000c3';
    raise notice 'FAIL 7. published a service with no assigned lawyer';
  exception when others then
    raise notice 'PASS 7. publish refused: %', sqlerrm;
  end;

  --------------------- 7b. ADR-0005: AI-written text cannot skip lawyer review
  begin
    insert into public.service_versions (service_id, version, generation_mode, review_mode)
    values ('00000000-0000-0000-0000-0000000000b1', 99, 'full_generation', 'auto');
    raise notice 'FAIL 7b. full_generation + auto was accepted';
  exception when check_violation then
    raise notice 'PASS 7b. full_generation + auto rejected by check constraint';
  end;

  begin
    insert into public.service_versions (service_id, version, generation_mode, review_mode)
    values ('00000000-0000-0000-0000-0000000000b1', 98, 'block_assembly', 'auto');
    raise notice 'FAIL 7c. block_assembly + auto was accepted';
  exception when check_violation then
    raise notice 'PASS 7c. block_assembly + auto rejected by check constraint';
  end;

  begin
    insert into public.service_versions (service_id, version, generation_mode, review_mode)
    values ('00000000-0000-0000-0000-0000000000b1', 97, 'template', 'auto');
    raise notice 'PASS 7d. template + auto is still allowed';
  exception when others then
    raise notice 'FAIL 7d. template + auto was rejected: %', sqlerrm;
  end;

  --------------------------- 8. a draft is still fully editable and deletable
  begin
    update public.service_versions set review_mode = 'lawyer_required'
    where id = '00000000-0000-0000-0000-0000000000c3';
    delete from public.service_versions where id = '00000000-0000-0000-0000-0000000000c3';
    raise notice 'PASS 8. drafts remain editable and deletable';
  exception when others then
    raise notice 'FAIL 8. a draft was blocked: %', sqlerrm;
  end;

  ------------------- 8b. the live slot cannot be taken without publishing
  -- Found by probing, not by reading: "live" is defined by status and "frozen"
  -- by published_at, and a version inserted straight as paused used to satisfy
  -- the first without the second — live and editable at once.
  begin
    insert into public.service_versions
      (service_id, version, generation_mode, review_mode, status)
    values ('00000000-0000-0000-0000-0000000000b1', 50, 'template', 'auto', 'paused');
    raise notice 'FAIL 8b. a never-published version took the live slot';
  exception when check_violation then
    raise notice 'PASS 8b. the live slot requires publication';
  end;

  ------------------------------------- 8c. publication is a one-way door
  begin
    update public.service_versions set status = 'draft'
    where id = '00000000-0000-0000-0000-0000000000c2';
    raise notice 'FAIL 8c. a published version walked back to draft';
  exception when others then
    raise notice 'PASS 8c. no walk-back to a pre-publication status';
  end;

  ------------------------- 8d. but archiving an unpublished draft is fine
  begin
    insert into public.service_versions
      (service_id, version, generation_mode, review_mode, status)
    values ('00000000-0000-0000-0000-0000000000b1', 51, 'template', 'auto', 'archived');
    raise notice 'PASS 8d. an abandoned draft can still be archived';
  exception when others then
    raise notice 'FAIL 8d. archiving a draft was blocked: %', sqlerrm;
  end;
end;
$$;

-- RLS scenarios --------------------------------------------------------------
-- Superuser bypasses RLS, so these run as the `authenticated` role with the
-- JWT claims PostgREST would set.

do $$
declare
  n integer;
begin
  set local role authenticated;

  ---------------------------------------------------------------- 9. lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';

  select count(*) into n from public.services;
  raise notice '% 9. lawyer reads the catalogue (saw % rows)',
    case when n = 2 then 'PASS' else 'FAIL' end, n;

  begin
    insert into public.services (slug, title) values ('sneaky', 'Lawyer-created');
    raise notice 'FAIL 9b. lawyer inserted a service';
  exception when insufficient_privilege then
    raise notice 'PASS 9b. lawyer insert denied by policy';
  end;

  ------------------------------------- 9c-9h. the assigned lawyer's draft rights
  begin
    update public.services set summary = 'Rewritten by the expert'
    where id = '00000000-0000-0000-0000-0000000000b1';
    raise notice 'PASS 9c. lawyer edits the summary of their own service';
  exception when others then
    raise notice 'FAIL 9c. lawyer could not edit their own service: %', sqlerrm;
  end;

  begin
    update public.services set slug = 'stolen'
    where id = '00000000-0000-0000-0000-0000000000b1';
    raise notice 'FAIL 9d. lawyer changed the slug';
  exception when others then
    raise notice 'PASS 9d. slug guarded: %', sqlerrm;
  end;

  begin
    update public.services set assigned_lawyer_id = null
    where id = '00000000-0000-0000-0000-0000000000b1';
    raise notice 'FAIL 9e. lawyer reassigned their own service';
  exception when others then
    raise notice 'PASS 9e. reassignment guarded: %', sqlerrm;
  end;

  begin
    update public.services set summary = 'Not mine'
    where id = '00000000-0000-0000-0000-0000000000b2';
    get diagnostics n = row_count;
    raise notice '% 9f. lawyer cannot edit a service assigned to nobody (% rows)',
      case when n = 0 then 'PASS' else 'FAIL' end, n;
  exception when others then
    raise notice 'PASS 9f. denied: %', sqlerrm;
  end;

  begin
    insert into public.service_versions (id, service_id, version, generation_mode, review_mode)
    values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b1', 3,
            'full_generation', 'lawyer_required');
    update public.service_versions set review_mode = 'lawyer_required', status = 'in_review'
    where id = '00000000-0000-0000-0000-0000000000c4';
    raise notice 'PASS 9g. lawyer creates and edits a draft version';
  exception when others then
    raise notice 'FAIL 9g. lawyer blocked on their own draft: %', sqlerrm;
  end;

  begin
    update public.service_versions set status = 'published'
    where id = '00000000-0000-0000-0000-0000000000c4';
    raise notice 'FAIL 9h. lawyer published a version';
  exception when others then
    raise notice 'PASS 9h. lawyer cannot publish';
  end;

  begin
    insert into public.service_version_prices
    values ('00000000-0000-0000-0000-0000000000c4', 'UAH', 1);
    raise notice 'FAIL 9i. lawyer set a price';
  exception when insufficient_privilege then
    raise notice 'PASS 9i. pricing stays with the admin';
  end;

  ----------------------------------------------------------------- 10. admin
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';

  insert into public.services (slug, title) values ('by-admin', 'Admin-created');
  raise notice 'PASS 10. admin insert allowed';

  -------------------------------------------------- 11. approved-but-no-role
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{}}';

  select count(*) into n from public.services;
  raise notice '% 11. a user with no role sees nothing (saw % rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;
end;
$$;

rollback;
