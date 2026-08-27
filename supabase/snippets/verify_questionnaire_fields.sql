-- Verification scenarios for 20260811130000_questionnaire_fields.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_questionnaire_fields.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Written after ADM-18 and ADM-19 shipped, and specifically to replace a
-- verification that had happened only in a browser: a lawyer assigned to a
-- service edited a field and reordered the list, and the rows were read back by
-- hand in `psql`. That proved the write policy works on the day it was done and
-- nothing afterwards. This file is the same claim, re-runnable.
--
-- Three things the scenarios are built around:
--
--   * **The screen and the constraints must refuse the same rows.** The editor
--     turns each refusal into a sentence before the round trip, which is a
--     convenience — the guarantee is here. Every branch of
--     `questionnaire_fields_gdpr_triad` and `_special_category` is asserted in
--     both directions, because a constraint stated one way lets the *other* way
--     through: a basis left behind by a field that stopped being personal data.
--   * **Denials are separated by how they fail.** A missing grant raises; a
--     policy `using` clause writes nothing and says nothing. Asserting the
--     second by looking for an exception would pass while the rule did nothing,
--     so those scenarios count rows.
--   * **The assigned-lawyer arm is the interesting one.** Admin-writes-anything
--     is easy to get right and easy to test; the rule that carries the design is
--     that a lawyer writes the dictionary of the service they answer for, and
--     not of the one next to it.
--
-- The counts are scoped to this script's own fixtures — every one uses the
-- `00000000-` prefix — because a script that assumes an empty baseline fails on
-- the seed rather than on the schema.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000e001a', 'qf-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000e001b', 'qf-assigned@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000e001c', 'qf-stranger@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000e001a';
update public.profiles set role = 'lawyer', full_name = 'The Assigned Lawyer'
where id = '00000000-0000-0000-0000-0000000e001b';
update public.profiles set role = 'lawyer', full_name = 'A Stranger'
where id = '00000000-0000-0000-0000-0000000e001c';

-- Two services, and only the first has an accountable lawyer. The second is
-- what scenarios 12 and 13 turn on: the same lawyer, a service that is not
-- theirs.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000ea001', 'qf-divorce', 'Divorce petition', 'family'),
  ('00000000-0000-0000-0000-0000000ea002', 'qf-alimony', 'Alimony claim', 'family');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000ea001', '00000000-0000-0000-0000-0000000e001b', true);

-- The shape of the dictionary (§4.4) ----------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  --------------------------------------------- 1. a key is machine-readable
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000ea001', 'Applicant Name', 'Applicant', 'text');
    raise notice 'FAIL 1. a key with a space and a capital was accepted';
  exception when check_violation then
    raise notice 'PASS 1. a key that blocks cannot reference is refused';
  end;

  ------------------------------------------- 1b. and the shape that is right
  insert into public.questionnaire_fields
    (id, service_id, key, label, field_type, required, position)
  values ('00000000-0000-0000-0000-0000000ec001', '00000000-0000-0000-0000-0000000ea001',
          'applicant_name', 'Applicant''s full name', 'text', true, 0);
  raise notice 'PASS 1b. a lowercase key with underscores is a key';

  ------------------------------------- 2. one key, one service, one field
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000ea001', 'applicant_name', 'Again', 'text');
    raise notice 'FAIL 2. one service holds the same key twice';
  exception when unique_violation then
    raise notice 'PASS 2. a key already used by this service is refused';
  end;

  --------------------------- 2b. and the same key on another service is fine
  insert into public.questionnaire_fields
    (id, service_id, key, label, field_type, position)
  values ('00000000-0000-0000-0000-0000000ec002', '00000000-0000-0000-0000-0000000ea002',
          'applicant_name', 'Applicant', 'text', 0);
  raise notice 'PASS 2b. two services may each ask for an applicant_name';

  ------------------------------------ 3. a key is an identifier, not a label
  begin
    update public.questionnaire_fields set key = 'renamed_key'
    where id = '00000000-0000-0000-0000-0000000ec001';
    raise notice 'FAIL 3. a key was renamed under a template that references it';
  exception when raise_exception then
    raise notice 'PASS 3. renaming a key is refused — the label is what changes';
  end;

  ------------------------------------------ 3b. and a field cannot change service
  begin
    update public.questionnaire_fields
    set service_id = '00000000-0000-0000-0000-0000000ea002'
    where id = '00000000-0000-0000-0000-0000000ec001';
    raise notice 'FAIL 3b. a field moved to another service, key and all';
  exception when raise_exception then
    raise notice 'PASS 3b. a field cannot move between services';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Choices belong to the choice types (§4.4) ---------------------------------------

do $$
begin
  set local role postgres;

  --------------------------------------- 4. a select with no options is not one
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type, options)
    values ('00000000-0000-0000-0000-0000000ea001', 'court_region', 'Region', 'select', null);
    raise notice 'FAIL 4. a select shipped with nothing to select';
  exception when check_violation then
    raise notice 'PASS 4. a select without options is refused';
  end;

  ------------------------------------------------- 4b. nor is an empty array one
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type, options)
    values ('00000000-0000-0000-0000-0000000ea001', 'court_region', 'Region', 'select',
            '[]'::jsonb);
    raise notice 'FAIL 4b. an empty options array was accepted';
  exception when check_violation then
    raise notice 'PASS 4b. an empty options array is refused';
  end;

  ----------------------------------- 5. options left on a type that takes none
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type, options)
    values ('00000000-0000-0000-0000-0000000ea001', 'marriage_date', 'Date', 'date',
            '["Kyiv"]'::jsonb);
    raise notice 'FAIL 5. a date field carries a list of choices';
  exception when check_violation then
    raise notice 'PASS 5. options on a non-choice type are refused';
  end;

  ------------------------------------------------------ 5b. and the shape that works
  insert into public.questionnaire_fields
    (id, service_id, key, label, field_type, position, options)
  values ('00000000-0000-0000-0000-0000000ec003', '00000000-0000-0000-0000-0000000ea001',
          'court_region', 'Court region', 'select', 1, '["Kyiv","Lviv"]'::jsonb);
  raise notice 'PASS 5b. a select with choices is a select';

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The GDPR triad, in both directions (ADR-0008, ADR-0013) -------------------------

do $$
begin
  set local role postgres;

  ------------------------------------ 6. personal data with no basis is refused
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, retention_days)
    values ('00000000-0000-0000-0000-0000000ea001', 'passport_no', 'Passport', 'text',
            true, 1095);
    raise notice 'FAIL 6. personal data was stored with no lawful basis';
  exception when check_violation then
    raise notice 'PASS 6. personal data without a basis is refused';
  end;

  --------------------------------- 7. and with no retention period, likewise
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis)
    values ('00000000-0000-0000-0000-0000000ea001', 'passport_no', 'Passport', 'text',
            true, 'contract');
    raise notice 'FAIL 7. personal data was stored with no retention period';
  exception when check_violation then
    raise notice 'PASS 7. personal data without a retention period is refused';
  end;

  ------------------------ 8. the constraint stated the other way round as well
  --
  -- This is the arm a screen forgets. Unticking "personal data" has to *clear*
  -- the basis and the retention; a form that only flips the flag leaves a row
  -- Postgres refuses, and the refusal names a constraint rather than the box
  -- the reader last touched.
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
    values ('00000000-0000-0000-0000-0000000ea001', 'passport_no', 'Passport', 'text',
            false, 'contract', 1095);
    raise notice 'FAIL 8. a basis survived on a field that is not personal data';
  exception when check_violation then
    raise notice 'PASS 8. a basis on non-personal data is refused';
  end;

  ------------------------------------------- 9. a retention period is a duration
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
    values ('00000000-0000-0000-0000-0000000ea001', 'passport_no', 'Passport', 'text',
            true, 'contract', 0);
    raise notice 'FAIL 9. a retention period of zero days was accepted';
  exception when check_violation then
    raise notice 'PASS 9. a retention period must be greater than zero';
  end;

  ---------------------- 10. Art. 9 is a second statement, never an alternative
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data,
       is_special_category, special_category_basis)
    values ('00000000-0000-0000-0000-0000000ea001', 'health', 'Health', 'long_text',
            false, true, 'legal_claims');
    raise notice 'FAIL 10. a special category was stored outside personal data';
  exception when check_violation then
    raise notice 'PASS 10. a special category that is not personal data is refused';
  end;

  ------------------------------- 10b. and it needs its own Art. 9(2) basis
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days,
       is_special_category)
    values ('00000000-0000-0000-0000-0000000ea001', 'health', 'Health', 'long_text',
            true, 'legitimate_interests', 1095, true);
    raise notice 'FAIL 10b. a special category was stored with no Art. 9(2) basis';
  exception when check_violation then
    raise notice 'PASS 10b. a special category without its own basis is refused';
  end;

  --------------------------------------------- 11. the complete row is accepted
  insert into public.questionnaire_fields
    (id, service_id, key, label, field_type, position, is_personal_data, legal_basis,
     retention_days, is_special_category, special_category_basis)
  values ('00000000-0000-0000-0000-0000000ec004', '00000000-0000-0000-0000-0000000ea001',
          'health_grounds', 'Health circumstances', 'long_text', 2,
          true, 'legitimate_interests', 1095, true, 'legal_claims');
  raise notice 'PASS 11. Art. 6 and Art. 9 together are a field';

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Who may write the dictionary (DoD §7) -------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------- 12. the lawyer answering for the service writes
  --
  -- The scenario the browser proved once. Counted rather than caught: a denial
  -- through `using` writes nothing and raises nothing, so an exception handler
  -- here would report success for a rule doing nothing at all.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e001b","app_metadata":{"role":"lawyer"}}';
  update public.questionnaire_fields set label = 'Edited by the assigned lawyer'
  where id = '00000000-0000-0000-0000-0000000ec001';
  get diagnostics n = row_count;
  raise notice '% 12. the assigned lawyer edits their service''s field (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 12b. and reorders it, which is two writes
  update public.questionnaire_fields set position = position + 10
  where service_id = '00000000-0000-0000-0000-0000000ea001';
  get diagnostics n = row_count;
  raise notice '% 12b. the assigned lawyer reorders the dictionary (% rows)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  ---------------------------- 13. and not the dictionary of a service next door
  update public.questionnaire_fields set label = 'Edited by somebody else'
  where id = '00000000-0000-0000-0000-0000000ec002';
  get diagnostics n = row_count;
  raise notice '% 13. a lawyer does not edit a service they do not answer for (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 14. a stranger writes nothing at all
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e001c","app_metadata":{"role":"lawyer"}}';
  delete from public.questionnaire_fields
  where id = '00000000-0000-0000-0000-0000000ec001';
  get diagnostics n = row_count;
  raise notice '% 14. a lawyer with no assignment deletes nothing (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------------------------- 15. an admin writes anywhere
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e001a","app_metadata":{"role":"admin"}}';
  update public.questionnaire_fields set label = 'Edited by the admin'
  where id = '00000000-0000-0000-0000-0000000ec002';
  get diagnostics n = row_count;
  raise notice '% 15. an admin edits any service''s dictionary (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------ 16. both staff roles read the whole set
  --
  -- Deliberate rather than an oversight: §4.4's stories are a lawyer's, and a
  -- lawyer comparing two services' questionnaires needs to read both. Asserted
  -- on purpose so that nobody "tightens" it later without meeting this line.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e001c","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.questionnaire_fields where id::text like '00000000-%';
  raise notice '% 16. an unassigned lawyer still reads the dictionary (% fields)',
    case when n = 4 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- `anon` holds nothing here ---------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role anon;

  ---------------------------------------------- 17. not even a look at the table
  begin
    select count(*) into n from public.questionnaire_fields;
    raise notice 'FAIL 17. anon selected from the questionnaire dictionary (% rows)', n;
  exception when insufficient_privilege then
    raise notice 'PASS 17. anon holds no privilege on questionnaire_fields';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
