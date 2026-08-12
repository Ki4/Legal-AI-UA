-- Verification scenarios for 20260812120000_practice_areas.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_practice_areas.sql

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'area-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'area-lawyer@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'area-pending@test.local');

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'lawyer', full_name = 'A Lawyer'
where id = '00000000-0000-0000-0000-0000000000d2';
-- d3 keeps role = null: registered, not yet approved.

insert into public.practice_areas (code, label_uk, label_en, position) values
  ('test_used', 'Тестова галузь', 'Test area, in use', 900),
  ('test_free', 'Вільна галузь', 'Test area, unused', 910);

insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000e1', 'area-probe', 'Area probe', 'test_used');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d2', true);

-- Shape --------------------------------------------------------------------

do $$
declare
  n integer;
begin
  ---------------------------------------- 1. a service cannot exist without one
  begin
    insert into public.services (slug, title) values ('no-area', 'No area');
    raise notice 'FAIL 1. a service was filed under no area at all';
  exception when not_null_violation then
    raise notice 'PASS 1. every service sits in a practice area';
  end;

  ------------------------------------------------ 2. and not under a made-up one
  begin
    insert into public.services (slug, title, practice_area)
    values ('bad-area', 'Bad area', 'astrology');
    raise notice 'FAIL 2. a service was filed under an area that does not exist';
  exception when foreign_key_violation then
    raise notice 'PASS 2. the area has to be one of ours';
  end;

  --------------------------------------------- 3. a code is permanent
  begin
    update public.practice_areas set code = 'renamed' where code = 'test_free';
    raise notice 'FAIL 3. a practice area code was rewritten';
  exception when others then
    raise notice 'PASS 3. a code cannot be rewritten: %', sqlerrm;
  end;

  ------------------------------- 4. an area in use cannot be deleted
  begin
    delete from public.practice_areas where code = 'test_used';
    raise notice 'FAIL 4. an area with services behind it was deleted';
  exception when foreign_key_violation then
    raise notice 'PASS 4. an area in use cannot be deleted — it is retired instead';
  end;

  ------------------------------------- 4b. ...but retiring it always works
  update public.practice_areas set is_active = false where code = 'test_used';
  select count(*) into n from public.services s
  join public.practice_areas a on a.code = s.practice_area
  where s.id = '00000000-0000-0000-0000-0000000000e1';
  raise notice '% 4b. a retired area still resolves for the services under it (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  --------------------------------------- 5. an unused area can be deleted
  begin
    delete from public.practice_areas where code = 'test_free';
    raise notice 'PASS 5. an unused area can be deleted outright';
  exception when others then
    raise notice 'FAIL 5. an unused area could not be deleted: %', sqlerrm;
  end;

  ------------------------------------------- 6. adding one is data, not schema
  begin
    insert into public.practice_areas (code, label_uk, label_en, position)
    values ('maritime', 'Морське право', 'Maritime', 920);
    raise notice 'PASS 6. a sixteenth area is one insert';
  exception when others then
    raise notice 'FAIL 6. adding an area failed: %', sqlerrm;
  end;

  ----------------------------------------- 6b. a malformed code is refused
  begin
    insert into public.practice_areas (code, label_uk, label_en, position)
    values ('Family Law!', 'Погана', 'Bad', 930);
    raise notice 'FAIL 6b. a code with spaces and punctuation was accepted';
  exception when check_violation then
    raise notice 'PASS 6b. a code has to be usable in a URL';
  end;
end;
$$;

-- Rights -------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ---------------------------------------------- 7. staff read the areas
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.practice_areas;
  raise notice '% 7. a lawyer can read the areas (% rows)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 8. a pending registration reads nothing
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","app_metadata":{}}';
  select count(*) into n from public.practice_areas;
  raise notice '% 8. a registration awaiting approval has no catalogue (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------------- 9. a lawyer cannot invent an area
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.practice_areas (code, label_uk, label_en, position)
    values ('lawyer_made', 'Своя', 'Made by a lawyer', 940);
    raise notice 'FAIL 9. a lawyer added a practice area';
  exception when insufficient_privilege then
    raise notice 'PASS 9. the list of areas is an admin decision';
  end;

  ------------------- 9b. ...nor silently delete one, which RLS would do quietly
  delete from public.practice_areas where code = 'maritime';
  get diagnostics n = row_count;
  raise notice '% 9b. a lawyer deleting an area removes nothing (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------ 10. the assigned lawyer cannot refile their own service
  -- They own the draft's content; where it sits in the catalogue is an admin's
  -- call, exactly like the slug (§13).
  begin
    update public.services set practice_area = 'civil'
    where id = '00000000-0000-0000-0000-0000000000e1';
    raise notice 'FAIL 10. the assigned lawyer moved their service to another area';
  exception when others then
    raise notice 'PASS 10. filing is a catalogue decision: %', sqlerrm;
  end;

  ------------------------------------------- 11. the admin can, and it is logged
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","app_metadata":{"role":"admin"}}';
  update public.services set practice_area = 'civil'
  where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  raise notice '% 11. an admin refiles a service (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  set local role postgres;
  select count(*) into n from public.audit_events
  where entity_table = 'services'
    and service_id = '00000000-0000-0000-0000-0000000000e1'
    and 'practice_area' = any (changed_columns);
  raise notice '% 11b. the move is on the record with the column named (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;
end;
$$;

rollback;
