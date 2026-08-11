-- Verification scenarios for 20260811130000_questionnaire_fields.sql.
-- Each check prints PASS or FAIL; the whole run is rolled back at the end.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_questionnaire_fields.sql

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'lawyer@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'other-lawyer@test.local');

update public.profiles set role = 'lawyer' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'lawyer' where id = '00000000-0000-0000-0000-0000000000a3';

insert into public.services (id, slug, title) values
  ('00000000-0000-0000-0000-0000000000b1', 'divorce', 'Divorce petition');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', true);

-- Constraints ---------------------------------------------------------------

do $$
declare
  n integer;
begin
  ----------------------------------------------- 1. an ordinary non-PII field
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'court_name', 'Court', 'text');
    raise notice 'PASS 1. a plain field needs no GDPR attributes';
  exception when others then
    raise notice 'FAIL 1. plain field rejected: %', sqlerrm;
  end;

  ------------------------------- 2. personal data without a basis is rejected
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type, is_personal_data)
    values ('00000000-0000-0000-0000-0000000000b1', 'client_name', 'Full name', 'text', true);
    raise notice 'FAIL 2. personal data accepted with no basis and no retention';
  exception when check_violation then
    raise notice 'PASS 2. personal data without basis + retention rejected';
  end;

  ------------------------------------ 3. ... and without retention is rejected
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis)
    values ('00000000-0000-0000-0000-0000000000b1', 'client_name', 'Full name', 'text',
            true, 'contract');
    raise notice 'FAIL 3. personal data accepted with a basis but no retention';
  exception when check_violation then
    raise notice 'PASS 3. personal data without retention rejected';
  end;

  --------------------------------------------- 4. the complete triad is fine
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
    values ('00000000-0000-0000-0000-0000000000b1', 'client_name', 'Full name', 'text',
            true, 'contract', 2555);
    raise notice 'PASS 4. a complete GDPR triad is accepted';
  exception when others then
    raise notice 'FAIL 4. complete triad rejected: %', sqlerrm;
  end;

  --------------------------- 5. a basis on a non-personal field is rejected
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
    values ('00000000-0000-0000-0000-0000000000b1', 'stray', 'Stray', 'text',
            false, 'contract', 30);
    raise notice 'FAIL 5. a non-personal field carried a legal basis';
  exception when check_violation then
    raise notice 'PASS 5. attributes cannot dangle on a non-personal field';
  end;

  -------------------- 6. special category is a subset, not an alternative
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_special_category, special_category_basis)
    values ('00000000-0000-0000-0000-0000000000b1', 'diagnosis', 'Diagnosis', 'long_text',
            true, 'legal_claims');
    raise notice 'FAIL 6. special category accepted without is_personal_data';
  exception when check_violation then
    raise notice 'PASS 6. special category requires is_personal_data';
  end;

  ----------------------- 7. ... and needs its own Art. 9(2) basis, not Art. 6
  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days,
       is_special_category)
    values ('00000000-0000-0000-0000-0000000000b1', 'diagnosis', 'Diagnosis', 'long_text',
            true, 'contract', 2555, true);
    raise notice 'FAIL 7. special category accepted with no Art. 9(2) basis';
  exception when check_violation then
    raise notice 'PASS 7. an Art. 6 basis does not stand in for an Art. 9 one';
  end;

  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days,
       is_special_category, special_category_basis)
    values ('00000000-0000-0000-0000-0000000000b1', 'diagnosis', 'Diagnosis', 'long_text',
            true, 'contract', 2555, true, 'legal_claims');
    raise notice 'PASS 7b. a fully declared special-category field is accepted';
  exception when others then
    raise notice 'FAIL 7b. complete special-category field rejected: %', sqlerrm;
  end;

  ---------------------------------------------------- 8. key shape and options
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'Client Name', 'Bad key', 'text');
    raise notice 'FAIL 8. a key with spaces and capitals was accepted';
  exception when check_violation then
    raise notice 'PASS 8. key shape enforced';
  end;

  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'marital_status', 'Status', 'select');
    raise notice 'FAIL 8b. a select with no options was accepted';
  exception when check_violation then
    raise notice 'PASS 8b. select requires options';
  end;

  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type, options)
    values ('00000000-0000-0000-0000-0000000000b1', 'court_name_2', 'Court', 'text',
            '["a","b"]'::jsonb);
    raise notice 'FAIL 8c. options were accepted on a text field';
  exception when check_violation then
    raise notice 'PASS 8c. options only belong to choice fields';
  end;

  --------------------------------------------------- 9. keys are unique and immutable
  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'court_name', 'Duplicate', 'text');
    raise notice 'FAIL 9. a duplicate key was accepted within one service';
  exception when unique_violation then
    raise notice 'PASS 9. keys are unique per service';
  end;

  begin
    update public.questionnaire_fields set key = 'renamed'
    where service_id = '00000000-0000-0000-0000-0000000000b1' and key = 'court_name';
    raise notice 'FAIL 9b. a key was renamed';
  exception when others then
    raise notice 'PASS 9b. key immutable: %', sqlerrm;
  end;

  begin
    update public.questionnaire_fields set label = 'Court of first instance'
    where service_id = '00000000-0000-0000-0000-0000000000b1' and key = 'court_name';
    raise notice 'PASS 9c. the label is still free to change';
  exception when others then
    raise notice 'FAIL 9c. label change rejected: %', sqlerrm;
  end;
end;
$$;

-- RLS -----------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------------------------- 10. the assigned lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';

  begin
    insert into public.questionnaire_fields
      (service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
    values ('00000000-0000-0000-0000-0000000000b1', 'spouse_name', 'Spouse', 'text',
            true, 'contract', 2555);
    raise notice 'PASS 10. the assigned lawyer declares fields on their own service';
  exception when others then
    raise notice 'FAIL 10. assigned lawyer blocked: %', sqlerrm;
  end;

  ------------------------------------------------- 11. a different lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"lawyer"}}';

  select count(*) into n from public.questionnaire_fields;
  raise notice '% 11. another lawyer still reads the dictionary (% rows)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'intruder', 'Intruder', 'text');
    raise notice 'FAIL 11b. a lawyer wrote to a service that is not theirs';
  exception when insufficient_privilege then
    raise notice 'PASS 11b. write denied on a service assigned to someone else';
  end;

  update public.questionnaire_fields set label = 'Hijacked'
  where key = 'court_name';
  get diagnostics n = row_count;
  raise notice '% 11c. update on someone else''s field silently matches nothing (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------------------------------------- 12. admin
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';

  begin
    insert into public.questionnaire_fields (service_id, key, label, field_type)
    values ('00000000-0000-0000-0000-0000000000b1', 'admin_added', 'Added by admin', 'text');
    raise notice 'PASS 12. an admin may still write any dictionary';
  exception when others then
    raise notice 'FAIL 12. admin blocked: %', sqlerrm;
  end;

  ------------------------------------------------------ 13. no role at all
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{}}';

  select count(*) into n from public.questionnaire_fields;
  raise notice '% 13. a user with no role sees nothing (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;
end;
$$;

rollback;
