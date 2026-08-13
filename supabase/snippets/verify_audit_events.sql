-- Verification scenarios for 20260811150000_audit_event_log.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_audit_events.sql
--
-- Everything runs inside one transaction and is rolled back, DDL included.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'lawyer@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'other@test.local');
update public.profiles set role = 'lawyer' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'lawyer' where id = '00000000-0000-0000-0000-0000000000a3';

-- Recording -----------------------------------------------------------------

do $$
declare
  n integer;
  cols text[];
  who uuid;
  role_at_the_time text;
  svc uuid;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';

  ------------------------------------------------ 1. a write becomes an event
  insert into public.services (id, slug, title, practice_area)
  values ('00000000-0000-0000-0000-0000000000b1', 'divorce', 'Divorce', 'family');
  insert into public.service_assignments (service_id, lawyer_id, is_primary)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', true);

  set local role postgres;
  -- Scoped to this script's own service: seed.sql creates its own, and their
  -- events are just as real.
  select count(*) into n from public.audit_events
  where entity_table = 'services' and action = 'insert'
    and service_id = '00000000-0000-0000-0000-0000000000b1';

  select actor_id, actor_role, service_id into who, role_at_the_time, svc
  from public.audit_events
  where entity_table = 'services' and action = 'insert'
    and service_id = '00000000-0000-0000-0000-0000000000b1'
  order by id desc limit 1;

  raise notice '% 1. creating a service is recorded (% event)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;
  raise notice '% 1b. the actor and the role held at the time are on the row (%, %)',
    case when who = '00000000-0000-0000-0000-0000000000a2' and role_at_the_time = 'admin'
      then 'PASS' else 'FAIL' end, who, role_at_the_time;
  raise notice '% 1c. the event is attributed to the service',
    case when svc = '00000000-0000-0000-0000-0000000000b1' then 'PASS' else 'FAIL' end;

  ------------------------------------------- 2. publishing names what changed
  insert into public.service_versions (id, service_id, version, generation_mode, review_mode)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 1,
          'template', 'auto');
  -- Before publishing: prices freeze with the version (ADR-0009).
  insert into public.service_version_prices
  values ('00000000-0000-0000-0000-0000000000c1', 'UAH', 550000);
  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-0000000000c1';

  select changed_columns into cols from public.audit_events
  where entity_table = 'service_versions' and action = 'update'
  order by id desc limit 1;

  raise notice '% 2. publication records the columns that moved (%)',
    case when cols @> array['status', 'published_at', 'published_by'] then 'PASS' else 'FAIL' end,
    cols;

  --------------------------- 3. a price event still resolves to its service
  select service_id into svc from public.audit_events
  where entity_table = 'service_version_prices' order by id desc limit 1;
  raise notice '% 3. a price event carries the service it belongs to',
    case when svc = '00000000-0000-0000-0000-0000000000b1' then 'PASS' else 'FAIL' end;

  ------------------- 4. the silent GDPR downgrade is no longer silent
  insert into public.questionnaire_fields
    (id, service_id, key, label, field_type, is_personal_data, legal_basis, retention_days)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1',
          'client_name', 'Name', 'text', true, 'contract', 2555);

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';
  update public.questionnaire_fields
  set is_personal_data = false, legal_basis = null, retention_days = null
  where id = '00000000-0000-0000-0000-0000000000d1';

  set local role postgres;
  select changed_columns, actor_id into cols, who from public.audit_events
  where entity_table = 'questionnaire_fields' and action = 'update' order by id desc limit 1;
  raise notice '% 4. dropping a retention obligation is recorded, with its author (%)',
    case when cols @> array['is_personal_data', 'legal_basis', 'retention_days']
      and who = '00000000-0000-0000-0000-0000000000a1' then 'PASS' else 'FAIL' end, cols;

  ------------------------------------------- 5. an update that changed nothing
  select count(*) into n from public.audit_events;
  update public.services set title = 'Divorce' where id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 5. a no-op update writes no event',
    case when (select count(*) from public.audit_events) = n then 'PASS' else 'FAIL' end;
  -- Hand the session back. The next block has to state who it is rather than
  -- inherit whatever this one happened to leave set.
  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Immutability ---------------------------------------------------------------

do $$
declare
  n integer;
begin
  -- Stated rather than inherited: as the owner, so this block's assertions are
  -- about the schema and not about anybody's rights.
  set local role postgres;

  begin
    update public.audit_events set actor_role = 'rewritten';
    raise notice 'FAIL 6. an audit row was updated';
  exception when others then
    raise notice 'PASS 6. update refused: %', sqlerrm;
  end;

  begin
    delete from public.audit_events;
    raise notice 'FAIL 6b. audit rows were deleted';
  exception when others then
    raise notice 'PASS 6b. delete refused';
  end;

  begin
    truncate public.audit_events;
    raise notice 'FAIL 6c. the log was truncated';
  exception when others then
    raise notice 'PASS 6c. truncate refused — service_role holds this privilege by default';
  end;

  ----------------------------- 7. history survives the thing it describes
  select count(*) into n from public.audit_events
  where service_id = '00000000-0000-0000-0000-0000000000b1';
  delete from public.questionnaire_fields where id = '00000000-0000-0000-0000-0000000000d1';
  raise notice '% 7. deleting the subject leaves its history standing (% -> %)',
    case when (select count(*) from public.audit_events
               where service_id = '00000000-0000-0000-0000-0000000000b1') > n
      then 'PASS' else 'FAIL' end,
    n,
    (select count(*) from public.audit_events
     where service_id = '00000000-0000-0000-0000-0000000000b1');
  -- Hand the session back. The next block has to state who it is rather than
  -- inherit whatever this one happened to leave set.
  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Redaction and unmapped tables ----------------------------------------------

do $$
declare
  payload jsonb;
  cols text[];
begin
  -- Stated rather than inherited: as the owner, so this block's assertions are
  -- about the schema and not about anybody's rights.
  set local role postgres;

  ------------------------------------------- 8. named, not valued (§6.4)
  drop trigger questionnaire_fields_audit on public.questionnaire_fields;
  create trigger questionnaire_fields_audit
  after insert or update or delete on public.questionnaire_fields
  for each row execute function public.audit_change ('label');

  insert into public.questionnaire_fields (service_id, key, label, field_type)
  values ('00000000-0000-0000-0000-0000000000b1', 'secret_field', 'Sensitive label', 'text');

  select after into payload from public.audit_events
  where entity_table = 'questionnaire_fields' order by id desc limit 1;

  raise notice '% 8. a redacted column is absent from the payload',
    case when not (payload ? 'label') and payload ? 'key' then 'PASS' else 'FAIL' end;

  update public.questionnaire_fields set label = 'Changed'
  where key = 'secret_field';
  select changed_columns, after into cols, payload from public.audit_events
  where entity_table = 'questionnaire_fields' order by id desc limit 1;

  raise notice '% 8b. ...but the fact that it changed is still on the record (%)',
    case when cols @> array['label'] and not (payload ? 'label') then 'PASS' else 'FAIL' end, cols;

  --------------------- 9. an unmapped table is refused, not quietly logged
  create table public.unmapped_thing (id uuid primary key default gen_random_uuid ());
  create trigger unmapped_thing_audit
  after insert on public.unmapped_thing
  for each row execute function public.audit_change ();

  begin
    insert into public.unmapped_thing default values;
    raise notice 'FAIL 9. a table with no entity mapping was logged anyway';
  exception when others then
    raise notice 'PASS 9. unmapped table refused: %', sqlerrm;
  end;
  -- Hand the session back. The next block has to state who it is rather than
  -- inherit whatever this one happened to leave set.
  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Reading --------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------------------------------ 10. no forged events
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","app_metadata":{"role":"admin"}}';
  begin
    insert into public.audit_events (action, entity_table, entity_id)
    values ('insert', 'services', '00000000-0000-0000-0000-0000000000b1');
    raise notice 'FAIL 10. a client role inserted an audit event';
  exception when insufficient_privilege then
    raise notice 'PASS 10. no INSERT grant — the browser cannot write the log';
  end;

  select count(*) into n from public.audit_events;
  raise notice '% 10b. an admin reads the whole log (% rows)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------------------- 11. a lawyer sees their own
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.audit_events
  where service_id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 11. the assigned lawyer reads their service history (% rows)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.audit_events
  where service_id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 11b. an unrelated lawyer reads none of this service (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{}}';
  select count(*) into n from public.audit_events;
  raise notice '% 11c. a user with no role reads none of it (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;
  -- Hand the session back. The next block has to state who it is rather than
  -- inherit whatever this one happened to leave set.
  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

rollback;
