-- Verification scenarios for 20260815120000_entitlements.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_entitlements.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Three things these scenarios are built around:
--
--   * **Coverage is asserted through the function, not through the tables.**
--     §8.6 says both purchase models resolve to one relation; a scenario that
--     checked a join would be checking its own copy of the rule rather than the
--     one every caller will use. So the questions asked here are the questions
--     ADM-63 and the staleness mechanism will ask.
--   * **The denials are the point, again — and this time they are silent.**
--     A lawyer cannot read what a client bought, and unlike `client_identities`
--     they are refused with an empty array rather than an error, because an
--     admin may read these rows and both arrive as the same database role.
--     Scenario 15 says why that is a design and not a slip, and 16 is the half
--     that makes it work: the question a lawyer's screen asks is still
--     answerable, through the function.
--   * **The constraints are tested from both sides.** A subscription without a
--     plan and a one-off wearing one are both refused; a term that ended and a
--     term that was revoked are distinguishable afterwards. Every one of these
--     had a plausible schema in which it was allowed.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'ent-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000e2', 'ent-lawyer@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set role = 'lawyer', full_name = 'A Lawyer'
where id = '00000000-0000-0000-0000-0000000000e2';

-- Two services, because coverage that cannot be shown to stop somewhere is not
-- coverage. The lawyer is assigned to the first one only, for the same reason.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000a1', 'lease-agreement', 'Lease agreement', 'property'),
  ('00000000-0000-0000-0000-0000000000a2', 'employment-contract', 'Employment contract', 'labour');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e2', true);

-- Three clients: one buys a one-off, one subscribes, one buys nothing.
insert into public.clients (id) values
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000d3');

insert into public.plans (code, label_uk, label_en) values
  ('annual', 'Річна підписка', 'Annual subscription');

insert into public.plan_services (plan_code, service_id) values
  ('annual', '00000000-0000-0000-0000-0000000000a1');

-- Shape --------------------------------------------------------------------

do $$
declare
  n integer;
  new_entitlement uuid;
begin
  -- Stated rather than inherited: as the owner, so this block's assertions are
  -- about the schema and not about anybody's rights.
  set local role postgres;

  ------------------------------------ 1. a subscription needs a plan to mean anything
  begin
    insert into public.entitlements (client_id, kind, valid_until)
    values ('00000000-0000-0000-0000-0000000000d2', 'subscription', now() + interval '1 year');
    raise notice 'FAIL 1. a subscription exists with no plan deciding what it covers';
  exception when check_violation then
    raise notice 'PASS 1. a subscription without a plan covers nothing and is refused (Q11)';
  end;

  --------------------------------------------- 1b. and a one-off must not wear one
  begin
    insert into public.entitlements (client_id, kind, plan_code)
    values ('00000000-0000-0000-0000-0000000000d1', 'one_off', 'annual');
    raise notice 'FAIL 1b. a one-off carries a plan, so it has two answers to what it covers';
  exception when check_violation then
    raise notice 'PASS 1b. a one-off names its own services and never a plan (Q10)';
  end;

  --------------------------- 2. a one-off has no end date, because §8.1 gave it none
  begin
    insert into public.entitlements (client_id, kind, valid_until)
    values ('00000000-0000-0000-0000-0000000000d1', 'one_off', now() + interval '1 year');
    raise notice 'FAIL 2. a one-off was given a calendar expiry it was never sold with';
  exception when check_violation then
    raise notice 'PASS 2. a one-off expires when the law moves, not on a date (§8.1)';
  end;

  ------------------------------------------- 2b. and a subscription must have one
  begin
    insert into public.entitlements (client_id, kind, plan_code)
    values ('00000000-0000-0000-0000-0000000000d2', 'subscription', 'annual');
    raise notice 'FAIL 2b. a subscription runs forever';
  exception when check_violation then
    raise notice 'PASS 2b. a subscription is a term and carries its end';
  end;

  ------------------------------- 3. a one-off covering nothing is not a purchase
  -- Deferred, so the failure lands at commit. The savepoint is what lets the
  -- transaction continue afterwards.
  begin
    insert into public.entitlements (id, client_id, kind)
    values ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-0000000000d1', 'one_off');
    -- Force the deferred trigger to fire now rather than at the end of the
    -- transaction, where it would take every later scenario down with it.
    set constraints public.entitlements_cover_something immediate;
    raise notice 'FAIL 3. an entitlement was sold that covers no service at all';
  exception when others then
    raise notice 'PASS 3. a one-off covers at least one service: %', sqlerrm;
  end;
  set constraints all deferred;

  ------------------------------------------- 4. the real thing: a one-off purchase
  insert into public.entitlements (id, client_id, kind)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'one_off');
  insert into public.entitlement_services (entitlement_id, service_id) values
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2');
  set constraints public.entitlements_cover_something immediate;
  set constraints all deferred;
  raise notice 'PASS 4. a package is one entitlement over two services, not two things (Q10)';

  ------------------------------------------------ 4b. and a subscription purchase
  insert into public.entitlements (id, client_id, kind, plan_code, valid_until)
  values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2',
          'subscription', 'annual', now() + interval '1 year');
  raise notice 'PASS 4b. a subscription is granted against a plan';

  --------------------------------- 5. a subscription does not name services itself
  begin
    insert into public.entitlement_services (entitlement_id, service_id)
    values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2');
    raise notice 'FAIL 5. a subscription carries a service list that will diverge from its plan';
  exception when others then
    raise notice 'PASS 5. a subscription covers what its plan covers, and only that';
  end;

  ------------------------------- 6. the last covered service cannot be taken away
  begin
    delete from public.entitlement_services
    where entitlement_id = '00000000-0000-0000-0000-0000000000b1';
    raise notice 'FAIL 6. a purchase was emptied out into covering nothing';
  exception when others then
    raise notice 'PASS 6. emptying a one-off is refused; deleting it is the operation';
  end;

  ------------------------ 6b. but one of two can go, and the entitlement stands
  delete from public.entitlement_services
  where entitlement_id = '00000000-0000-0000-0000-0000000000b1'
    and service_id = '00000000-0000-0000-0000-0000000000a2';
  select count(*) into n from public.entitlement_services
  where entitlement_id = '00000000-0000-0000-0000-0000000000b1';
  raise notice '% 6b. a package can be reduced while it still covers something (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  --------------------------------- 6c. and deleting the entitlement itself works
  -- The cascade removes the last child, which is exactly the case the guard
  -- above must not catch.
  insert into public.entitlements (id, client_id, kind)
  values ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d3', 'one_off');
  insert into public.entitlement_services (entitlement_id, service_id)
  values ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2');
  set constraints public.entitlements_cover_something immediate;
  set constraints all deferred;

  delete from public.entitlements where id = '00000000-0000-0000-0000-0000000000b3';
  select count(*) into n from public.entitlement_services
  where entitlement_id = '00000000-0000-0000-0000-0000000000b3';
  raise notice '% 6c. deleting an entitlement takes its coverage with it (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------ 7. a sold service cannot be deleted
  begin
    delete from public.services where id = '00000000-0000-0000-0000-0000000000a1';
    raise notice 'FAIL 7. a service somebody paid for was deleted, and the evidence with it';
  exception when foreign_key_violation then
    raise notice 'PASS 7. a service under a live entitlement is not deletable';
  end;

  ------------------------------------------- 8. a plan code is permanent
  begin
    update public.plans set code = 'annual_v2' where code = 'annual';
    raise notice 'FAIL 8. a plan code moved under the entitlements that refer to it';
  exception when others then
    raise notice 'PASS 8. a plan code cannot be rewritten';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Coverage -------------------------------------------------------------------
--
-- The one relation §8.6 asked for, asked the way its callers will ask it.

do $$
declare
  covered boolean;
begin
  set local role postgres;

  ------------------------------------------- 9. the one-off buyer, direct route
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 9. a one-off covers the service it names', case when covered then 'PASS' else 'FAIL' end;

  ------------------------------------------------- 9b. and not the one it dropped
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2');
  raise notice '% 9b. and stops at the edge of what was bought',
    case when not covered then 'PASS' else 'FAIL' end;

  --------------------------------------- 10. the subscriber, through their plan
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 10. a subscription covers what its plan covers, by the same call',
    case when covered then 'PASS' else 'FAIL' end;

  ------------------------------------ 10b. and the plan's edge is the coverage's
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2');
  raise notice '% 10b. a service outside the plan is outside the subscription',
    case when not covered then 'PASS' else 'FAIL' end;

  ------------------------------------------------ 11. somebody who bought nothing
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 11. a client who bought nothing is covered for nothing',
    case when not covered then 'PASS' else 'FAIL' end;

  --------------- 11b. the primitive answers about one purchase, not about a client
  -- The distinction the split exists for, and the reason an order records which
  -- entitlement paid for it. This client is covered for the second service — by
  -- a second purchase — and the first purchase still does not reach it. A guard
  -- that asked only the client-level question would accept the wrong pointer
  -- and record a document as paid for by a purchase that did not pay for it.
  insert into public.entitlements (id, client_id, kind)
  values ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000d1', 'one_off');
  insert into public.entitlement_services (entitlement_id, service_id)
  values ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a2');
  set constraints public.entitlements_cover_something immediate;
  set constraints all deferred;

  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2');
  raise notice '% 11b. a second purchase covers the client for the second service',
    case when covered then 'PASS' else 'FAIL' end;

  covered := public.entitlement_covers (
    '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2');
  raise notice '% 11c. and the first purchase still does not reach it',
    case when not covered then 'PASS' else 'FAIL' end;

  ------------------------------------------- 12. a term that ran out stops covering
  update public.entitlements
  set valid_from = now() - interval '2 years', valid_until = now() - interval '1 day'
  where id = '00000000-0000-0000-0000-0000000000b2';
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 12. an expired subscription covers nothing',
    case when not covered then 'PASS' else 'FAIL' end;

  ------------------------------------------------- 12b. a future grant is not live yet
  update public.entitlements
  set valid_from = now() + interval '1 day', valid_until = now() + interval '1 year'
  where id = '00000000-0000-0000-0000-0000000000b2';
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 12b. a subscription starting tomorrow does not cover today',
    case when not covered then 'PASS' else 'FAIL' end;

  ------------------------------------------------- 12c. and in its term it does
  update public.entitlements
  set valid_from = now() - interval '1 day', valid_until = now() + interval '1 year'
  where id = '00000000-0000-0000-0000-0000000000b2';
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 12c. a live term covers', case when covered then 'PASS' else 'FAIL' end;

  ---------------------------------- 13. revocation stops coverage without a lie
  -- The distinction the column exists for: after this, the row still says the
  -- term runs for another year *and* that coverage was withdrawn. Expressing a
  -- refund by moving `valid_until` backwards would have destroyed that.
  update public.entitlements set revoked_at = now()
  where id = '00000000-0000-0000-0000-0000000000b2';
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 13. a revoked subscription stops covering immediately',
    case when not covered then 'PASS' else 'FAIL' end;

  ------------------------------- 13b. and the term it was revoked from is still there
  select valid_until > now() into covered from public.entitlements
  where id = '00000000-0000-0000-0000-0000000000b2';
  raise notice '% 13b. a revoked term and a lapsed term stay different facts',
    case when covered then 'PASS' else 'FAIL' end;

  update public.entitlements set revoked_at = null
  where id = '00000000-0000-0000-0000-0000000000b2';

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Rights ---------------------------------------------------------------------

do $$
declare
  n integer;
  covered boolean;
begin
  set local role authenticated;

  --------------------------------------- 14. a lawyer reads the catalogue half
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.plans;
  raise notice '% 14. a lawyer sees which plans the firm sells (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  select count(*) into n from public.plan_services;
  raise notice '% 14b. and which services those plans cover (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 15. and is refused the billing half
  -- §7.3 and ADR-0014: what a client bought is administration.
  --
  -- **The refusal here is silent, and it could not have been otherwise.**
  -- `client_identities` fails loudly because its grant is withheld from
  -- everybody; an admin may read these rows, and both an admin and a lawyer
  -- reach Postgres as the same database role — `authenticated` — with the
  -- distinction living in the JWT, which a grant cannot see. So the grant must
  -- exist, the policy is what filters, and a lawyer gets the empty array §13
  -- warns about rather than an error.
  --
  -- That is the reason `client_is_entitled_to` is a function rather than a
  -- convenience. No lawyer-facing screen reads these tables at all, so nothing
  -- has to tell "you may not see this" apart from "there is nothing to see" —
  -- the ambiguity is designed out instead of detected.
  select count(*) into n from public.entitlements;
  raise notice '% 15. a lawyer reads no entitlement, silently (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------------------- 15b. list included
  select count(*) into n from public.entitlement_services;
  raise notice '% 15b. nor what any purchase covers (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------ 16. but the question their screen asks is still answerable
  -- This is what makes 15 a decision rather than an obstacle: the yes/no is
  -- staff business, the row is not.
  covered := public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1');
  raise notice '% 16. a lawyer can still ask whether a client is covered',
    case when covered then 'PASS' else 'FAIL' end;

  ------------------------------------- 17. an admin reads billing, because it is theirs
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","app_metadata":{"role":"admin"}}';
  select count(*) into n from public.entitlements;
  raise notice '% 17. an admin sees the entitlements (% rows)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------ 18. a lawyer does not edit the catalogue
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","app_metadata":{"role":"lawyer"}}';
  begin
    insert into public.plan_services (plan_code, service_id)
    values ('annual', '00000000-0000-0000-0000-0000000000a2');
    raise notice 'FAIL 18. a lawyer put their own service into a paid plan';
  exception when insufficient_privilege then
    raise notice 'PASS 18. a lawyer cannot add a service to a plan';
  end;

  --------------------------------- 18b. nor grants an entitlement to themselves
  begin
    insert into public.entitlements (client_id, kind, plan_code, valid_until)
    values ('00000000-0000-0000-0000-0000000000d3', 'subscription', 'annual',
            now() + interval '1 year');
    raise notice 'FAIL 18b. a lawyer granted a subscription';
  exception when insufficient_privilege then
    raise notice 'PASS 18b. granting coverage is an administrative act';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Audit ----------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ---------------------- 19. a service joining a plan is the assigned lawyer's news
  select count(*) into n from public.audit_events
  where entity_table = 'plan_services'
    and entity_id = '00000000-0000-0000-0000-0000000000a1'
    and service_id = '00000000-0000-0000-0000-0000000000a1'
    and action = 'insert';
  raise notice '% 19. adding a service to a plan is logged against that service (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  -------------------------------- 20. a purchase is logged, and to nobody's service
  -- The null is what keeps a client's purchases out of the lawyer's cut of the
  -- log. It would be an easy column to fill in helpfully and hard to notice
  -- afterwards, which is why it is asserted rather than assumed.
  select count(*) into n from public.audit_events
  where entity_table = 'entitlements'
    and entity_id = '00000000-0000-0000-0000-0000000000b1'
    and action = 'insert'
    and service_id is null;
  raise notice '% 20. a purchase is on the record and in nobody''s service cut (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 20b. and the payload names no person
  select count(*) into n from public.audit_events
  where entity_table = 'entitlements'
    and entity_id = '00000000-0000-0000-0000-0000000000b1'
    and after ? 'client_id';
  raise notice '% 20b. the payload carries the pseudonym and nothing more (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------ 21. and coverage changes are logged too
  select count(*) into n from public.audit_events
  where entity_table = 'entitlement_services'
    and entity_id = '00000000-0000-0000-0000-0000000000b1'
    and service_id is null;
  raise notice '% 21. every change to what a purchase covers is recorded (% events)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

rollback;
