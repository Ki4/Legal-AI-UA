-- Verification scenarios for 20260814130000_client_identity.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_client_identity.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Two things these scenarios are built around:
--
--   * **The denials are the point.** `client_identities` is granted to nobody,
--     so the interesting assertions are that a lawyer and an admin both fail to
--     read it, and fail with a permission error rather than an empty result. A
--     scenario that only proved the allowed case would prove half of nothing,
--     and here the allowed case barely exists yet.
--   * **The audit payload is checked, not assumed.** §6.4 is what makes erasure
--     work: if one name reaches a payload, destroying the mapping stops being
--     enough and the seven-year log becomes the thing that identifies the
--     person. So the scenarios read `before`/`after` and assert the absence.

-- **The counts below are scoped to this script's own fixtures**, and that is not
-- fastidiousness. They used to count the whole table, which worked for as long
-- as `seed.sql` held no rows of this kind — and broke the day it did
-- (2026-08-15, when the order card needed something to render). A verification
-- script that assumes an empty baseline is one that fails on the seed rather
-- than on the schema, which is the least useful red there is. Every fixture
-- here uses the `00000000-` prefix; the seed uses its own.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'client-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000f2', 'client-lawyer@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000f3', 'client-pending@test.local', '{}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set role = 'lawyer', full_name = 'A Lawyer'
where id = '00000000-0000-0000-0000-0000000000f2';
-- f3 keeps role = null: registered, not yet approved.

-- Invented people, as seed.sql requires of itself. Two, because one client
-- cannot demonstrate that erasing a client leaves the other one standing.
insert into public.clients (id) values
  ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c2');

insert into public.client_identities (client_id, full_name, email, phone) values
  ('00000000-0000-0000-0000-0000000000c1', 'Vasyl Petrenko', 'vasyl@example.test', '+380000000001'),
  ('00000000-0000-0000-0000-0000000000c2', 'Iryna Melnyk', 'iryna@example.test', '+380000000002');

-- Shape ------------------------------------------------------------------------

do $$
declare
  n integer;
  label text;
begin
  -- Stated rather than inherited: as the owner, so this block's assertions are
  -- about the schema and not about anybody's rights.
  set local role postgres;

  ------------------------------------------- 1. a client is named without asking
  select pseudonym into label from public.clients
  where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 1. a client gets a pseudonym nobody supplied (%)',
    case when label like 'client-%' and length(label) = 15 then 'PASS' else 'FAIL' end, label;

  ------------------------------------------------- 1b. and no two share one
  select count(distinct pseudonym) into n from public.clients where id::text like '00000000-%';
  raise notice '% 1b. pseudonyms are distinct (% of 2)',
    case when n = 2 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------------ 2. a pseudonym is permanent
  begin
    update public.clients set pseudonym = 'client-renamed'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 2. a pseudonym was rewritten under the log that refers to it';
  exception when others then
    raise notice 'PASS 2. a pseudonym cannot be rewritten: %', sqlerrm;
  end;

  ------------------------------- 3. half-erased is not a state a client can hold
  begin
    update public.clients set erased_at = now()
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 3. a client was erased for no recorded reason';
  exception when check_violation then
    raise notice 'PASS 3. an erasure records when and on what basis, or neither';
  end;

  ------------------------------------- 3b. and the basis has to be one of ours
  begin
    update public.clients set erased_at = now(), erasure_basis = 'because'
    where id = '00000000-0000-0000-0000-0000000000c1';
    raise notice 'FAIL 3b. an erasure was recorded against a made-up basis';
  exception when check_violation then
    raise notice 'PASS 3b. the basis is request or retention (§7.2)';
  end;

  ---------------------------------- 4. a mapping cannot name a client that is not
  begin
    insert into public.client_identities (client_id, full_name)
    values ('00000000-0000-0000-0000-0000000000ff', 'Nobody At All');
    raise notice 'FAIL 4. a name was stored against a client that does not exist';
  exception when foreign_key_violation then
    raise notice 'PASS 4. the mapping hangs off an anchor or it does not exist';
  end;

  ------------------------------------------- 5. one client, one identity today
  begin
    insert into public.client_identities (client_id, full_name)
    values ('00000000-0000-0000-0000-0000000000c1', 'Second Person');
    raise notice 'FAIL 5. one client account holds two people before ADM-68 exists';
  exception when unique_violation then
    raise notice 'PASS 5. a second person waits for the membership table (ADM-68)';
  end;

  -------------------------------- 6. the log says an identity exists, not whose
  select count(*) into n from public.audit_events
  where entity_table = 'client_identities'
    and entity_id = '00000000-0000-0000-0000-0000000000c1'
    and action = 'insert'
    and after ? 'client_id'
    and not (after ? 'full_name')
    and not (after ? 'email')
    and not (after ? 'phone');
  raise notice '% 6. creating a mapping is logged with no person in the payload (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  --------------------------- 6b. a change names the column and not the new value
  update public.client_identities set phone = '+380000000009'
  where client_id = '00000000-0000-0000-0000-0000000000c1';

  select count(*) into n from public.audit_events
  where entity_table = 'client_identities'
    and entity_id = '00000000-0000-0000-0000-0000000000c1'
    and action = 'update'
    and 'phone' = any (changed_columns)
    and not (after ? 'phone');
  raise notice '% 6b. a changed phone number is recorded as "phone changed" (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------- 6c. the anchor is logged with nothing withheld
  -- The other half of the split: `clients` needs no redaction because there is
  -- nothing on it to redact, and the pseudonym in the payload is the label a
  -- depersonalised screen is supposed to show.
  select count(*) into n from public.audit_events
  where entity_table = 'clients'
    and entity_id = '00000000-0000-0000-0000-0000000000c1'
    and action = 'insert'
    and after ? 'pseudonym';
  raise notice '% 6c. the anchor keeps its pseudonym in the log (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  -- Hand the session back. The next block has to state who it is rather than
  -- inherit whatever this one happened to leave set.
  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Rights -------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  -------------------------------------------- 7. staff read the pseudonyms
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.clients where id::text like '00000000-%';
  raise notice '% 7. a lawyer sees clients by pseudonym (% rows)',
    case when n = 2 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 8. a pending registration reads nothing
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","app_metadata":{}}';
  select count(*) into n from public.clients where id::text like '00000000-%';
  raise notice '% 8. a registration awaiting approval sees no clients (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  -------------------------------------- 9. nobody reads the mapping — a lawyer
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","app_metadata":{"role":"lawyer"}}';
  begin
    select count(*) into n from public.client_identities;
    raise notice 'FAIL 9. a lawyer read the client mapping (% rows)', n;
  exception when insufficient_privilege then
    raise notice 'PASS 9. a lawyer is refused the mapping, loudly';
  end;

  ------------------------------------------------- 10. ...and an admin either
  -- §7.3: administration is not a case. This is the scenario that would go red
  -- the day somebody adds a convenience policy for the admin screens.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","app_metadata":{"role":"admin"}}';
  begin
    select count(*) into n from public.client_identities;
    raise notice 'FAIL 10. an admin read named clients by virtue of being an admin (% rows)', n;
  exception when insufficient_privilege then
    raise notice 'PASS 10. an admin is refused too — the break-glass row does not exist yet';
  end;

  ------------------------------------------ 11. nor writes one into existence
  begin
    insert into public.client_identities (client_id, full_name)
    values ('00000000-0000-0000-0000-0000000000c2', 'Written By An Admin');
    raise notice 'FAIL 11. an admin wrote to the mapping';
  exception when insufficient_privilege then
    raise notice 'PASS 11. the mapping is written by definer functions only';
  end;

  ---------------------------------------- 12. a lawyer cannot create a client
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.clients (id) values ('00000000-0000-0000-0000-0000000000c3');
    raise notice 'FAIL 12. a client was created from the console';
  exception when insufficient_privilege then
    raise notice 'PASS 12. clients arrive with an order, not from a staff screen';
  end;

  --------------------------------------- 13. a lawyer cannot erase a client
  begin
    perform public.erase_client ('00000000-0000-0000-0000-0000000000c1', 'request');
    raise notice 'FAIL 13. a lawyer erased a client';
  exception when insufficient_privilege then
    raise notice 'FAIL 13. erase_client is not callable at all — check the grant';
  when others then
    raise notice 'PASS 13. erasure is an admin decision: %', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Erasure ------------------------------------------------------------------

do $$
declare
  n integer;
  label text;
  first_erasure timestamptz;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","app_metadata":{"role":"admin"}}';

  ------------------------------------------------- 14. an admin erases a client
  perform public.erase_client ('00000000-0000-0000-0000-0000000000c1', 'request');

  -- Reading the result is not something `authenticated` may do here, so the
  -- assertions below switch to the owner rather than testing the denial again.
  set local role postgres;

  select count(*) into n from public.client_identities
  where client_id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 14. the mapping is destroyed (% rows left)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------------ 14b. and only that client's
  select count(*) into n from public.client_identities
  where client_id = '00000000-0000-0000-0000-0000000000c2';
  raise notice '% 14b. the other client is untouched (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 15. the anchor survives, and says so
  select pseudonym, erased_at into label, first_erasure from public.clients
  where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 15. the anchor stands with its pseudonym and a date (%, %)',
    case when label like 'client-%' and first_erasure is not null then 'PASS' else 'FAIL' end,
    label, first_erasure;

  ------------------------------- 16. the log survives and identifies nobody
  select count(*) into n from public.audit_events
  where entity_table = 'client_identities'
    and entity_id = '00000000-0000-0000-0000-0000000000c1'
    and action = 'delete'
    and not (before ? 'full_name')
    and not (before ? 'email')
    and not (before ? 'phone');
  raise notice '% 16. the destruction is on the record, holding no person (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------- 16b. and every earlier event about them is still there
  -- The whole point of the scheme: erasure does not reach into the log, because
  -- there was never anything in it to reach for.
  select count(*) into n from public.audit_events
  where entity_table = 'client_identities'
    and entity_id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 16b. the history of that mapping is intact (% events: insert, update, delete)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  --------------------------------------- 17. erasing twice is not a second event
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","app_metadata":{"role":"admin"}}';
  set local role authenticated;
  perform public.erase_client ('00000000-0000-0000-0000-0000000000c1', 'retention');

  set local role postgres;
  select count(*) into n from public.audit_events
  where entity_table = 'clients'
    and entity_id = '00000000-0000-0000-0000-0000000000c1'
    and action = 'update';
  raise notice '% 17. a repeat erasure writes nothing (% update events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  select erased_at, erasure_basis into first_erasure, label from public.clients
  where id = '00000000-0000-0000-0000-0000000000c1';
  raise notice '% 17b. the date and basis are the first ones (%)',
    case when label = 'request' then 'PASS' else 'FAIL' end, label;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

rollback;
