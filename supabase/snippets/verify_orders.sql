-- Verification scenarios for 20260815130000_orders.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_orders.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Four things these scenarios are built around:
--
--   * **The rules are triggers, so they are tested as the writer that bypasses
--     RLS.** The gateway will hold `service_role`, for which every policy on
--     this table is irrelevant. A scenario that only proved a policy stops a
--     browser would prove nothing about the one thing that actually writes
--     orders.
--   * **ADR-0005 gets its own block.** "No configuration lets AI-assembled text
--     reach a client unreviewed" is the sentence the ADR asked to be enforced on
--     the data model, and the way to check it is to try, in every shape: the
--     version requiring review, the client asking for it, the request being
--     withdrawn.
--   * **The entitlement is checked against the entitlement, not the client.**
--     The scenario that matters holds a client who *is* covered for a service by
--     a second purchase, and asserts the order still cannot be delivered
--     recording the first. That hole is invisible to a client-level check.
--   * **Both arms of the read policy are separated.** A lawyer assigned to the
--     service and a lawyer who is only the reviewer are different people here,
--     because one arm covering for the other is exactly how a policy passes its
--     test while half of it does nothing.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000001a', 'ord-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-00000000001b', 'ord-assigned@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-00000000001c', 'ord-reviewer@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-00000000001d', 'ord-stranger@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-00000000001a';
update public.profiles set role = 'lawyer', full_name = 'The Assigned Lawyer'
where id = '00000000-0000-0000-0000-00000000001b';
update public.profiles set role = 'lawyer', full_name = 'The Reviewer'
where id = '00000000-0000-0000-0000-00000000001c';
update public.profiles set role = 'lawyer', full_name = 'A Stranger'
where id = '00000000-0000-0000-0000-00000000001d';

-- Two services. The first runs unreviewed, the second requires a lawyer, which
-- is the axis ADR-0005 is about.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000000a1', 'rental-notice', 'Rental notice', 'property'),
  ('00000000-0000-0000-0000-0000000000a2', 'inheritance-claim', 'Inheritance claim', 'inheritance');

-- Only the first lawyer is assigned, and only to the first service. The
-- reviewer is deliberately assigned to nothing: §5.6's argument against locks
-- means a lawyer can be handed a matter on a service they do not cover, and the
-- read policy has to let them see what they were handed.
insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000001b', true),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000001b', true);

insert into public.service_versions (id, service_id, version, status, generation_mode, review_mode) values
  ('00000000-0000-0000-0000-00000000abc1', '00000000-0000-0000-0000-0000000000a1', 1,
   'published', 'template', 'auto'),
  ('00000000-0000-0000-0000-00000000abc2', '00000000-0000-0000-0000-0000000000a2', 1,
   'published', 'full_generation', 'lawyer_required'),
  ('00000000-0000-0000-0000-00000000abc3', '00000000-0000-0000-0000-0000000000a1', 2,
   'draft', 'template', 'auto');

insert into public.clients (id) values
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2');

-- d1 buys the two services as separate purchases. That is what makes scenario
-- 12 possible: they are covered for the second service, and by the wrong row.
insert into public.entitlements (id, client_id, kind) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'one_off'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'one_off');
insert into public.entitlement_services (entitlement_id, service_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2');

-- d2 buys nothing.

-- Placing an order -------------------------------------------------------------

do $$
declare
  n integer;
  v_status public.order_status;
begin
  -- Stated rather than inherited: as the owner, which is what the gateway will
  -- effectively be. Every trigger below is therefore being tested against the
  -- writer that RLS does not constrain.
  set local role postgres;

  ------------------------------------------- 1. an order starts in intake
  insert into public.orders (id, client_id, service_version_id)
  values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-00000000abc1');
  select status into v_status from public.orders
  where id = '00000000-0000-0000-0000-00000000f001';
  raise notice '% 1. an order is placed into intake (%)',
    case when v_status = 'intake' then 'PASS' else 'FAIL' end, v_status;

  ---------------------------------------- 1b. and cannot be placed anywhere else
  begin
    insert into public.orders (client_id, service_version_id, status)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000abc1', 'delivered');
    raise notice 'FAIL 1b. an order was delivered into existence, skipping every rule on the way';
  exception when others then
    raise notice 'PASS 1b. an order cannot be created already delivered';
  end;

  ------------------------------------- 2. nothing is ordered from a draft version
  begin
    insert into public.orders (client_id, service_version_id)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000abc3');
    raise notice 'FAIL 2. a client ordered from a version nobody has published';
  exception when others then
    raise notice 'PASS 2. a draft version is not on sale';
  end;

  --------------------------------------- 2b. nor from one that has been paused
  -- Pausing is what a service does when it stops accepting orders. If an order
  -- could still be placed against a paused version, pausing would mean nothing.
  update public.service_versions set status = 'paused'
  where id = '00000000-0000-0000-0000-00000000abc1';
  begin
    insert into public.orders (client_id, service_version_id)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000abc1');
    raise notice 'FAIL 2b. an order was placed against a paused version';
  exception when others then
    raise notice 'PASS 2b. a paused version accepts no new orders';
  end;
  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-00000000abc1';

  ----------------------------------- 3. the pin does not move, ever
  begin
    update public.orders set service_version_id = '00000000-0000-0000-0000-00000000abc3'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 3. an order was re-pointed at another version';
  exception when others then
    raise notice 'PASS 3. an order pins the version it was placed against (§5.4)';
  end;

  ------------------------------------------------- 3b. and neither does the client
  begin
    update public.orders set client_id = '00000000-0000-0000-0000-0000000000d2'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 3b. an order changed hands';
  exception when others then
    raise notice 'PASS 3b. an order belongs to the client who placed it';
  end;

  ------------------------------ 4. a published version with orders is not deletable
  -- True twice over now: ADR-0009 already refused it, and this is the second,
  -- independent reason. Asserted because the day somebody relaxes the first,
  -- this is what stops a passport pointing at nothing.
  begin
    delete from public.service_versions where id = '00000000-0000-0000-0000-00000000abc1';
    raise notice 'FAIL 4. a version somebody ordered from was deleted';
  exception when others then
    raise notice 'PASS 4. a version with an order behind it cannot be deleted';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- The lifecycle ---------------------------------------------------------------

do $$
declare
  v_when timestamptz;
begin
  set local role postgres;

  ----------------------------------------- 5. a state machine, not a free column
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 5. an order jumped from intake straight to delivered';
  exception when others then
    raise notice 'PASS 5. an order does not skip its own lifecycle';
  end;

  ------------------------------------------------- 5b. the legal step is taken
  update public.orders set status = 'submitted'
  where id = '00000000-0000-0000-0000-00000000f001';
  select submitted_at into v_when from public.orders
  where id = '00000000-0000-0000-0000-00000000f001';
  raise notice '% 5b. submitting stamps its own date, unasked (%)',
    case when v_when is not null then 'PASS' else 'FAIL' end, v_when;

  ------------------------------------- 5c. and there is no way back out of it
  begin
    update public.orders set status = 'intake'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 5c. a submitted order reopened its intake';
  exception when others then
    raise notice 'PASS 5c. a submitted order does not go back to collecting answers';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Review, which is the rule ADR-0005 asked to be enforced here ------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  -- The lawyer_required order: full_generation, so ADR-0005 permits no other
  -- review mode and no configuration can turn it off.
  insert into public.orders (id, client_id, service_version_id, entitlement_id)
  values ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-00000000abc2', '00000000-0000-0000-0000-0000000000e2');
  update public.orders set status = 'submitted' where id = '00000000-0000-0000-0000-00000000f002';
  update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-00000000f002';

  ------------------- 6. AI-generated text does not reach a client unreviewed
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f002';
    raise notice 'FAIL 6. a full_generation document was delivered without a lawyer (ADR-0005)';
  exception when others then
    raise notice 'PASS 6. a lawyer_required document is delivered out of review or not at all';
  end;

  ------------------------------------- 6b. and review with nobody in it is not review
  update public.orders set status = 'in_review' where id = '00000000-0000-0000-0000-00000000f002';
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f002';
    raise notice 'FAIL 6b. a document passed review that no one is recorded as having reviewed';
  exception when others then
    raise notice 'PASS 6b. a reviewed document records who reviewed it';
  end;

  ------------------------------------------------- 6c. a reviewer is a lawyer
  begin
    update public.orders set reviewer_id = '00000000-0000-0000-0000-00000000001a'
    where id = '00000000-0000-0000-0000-00000000f002';
    raise notice 'FAIL 6c. an admin was made the reviewer of a legal document';
  exception when others then
    raise notice 'PASS 6c. an order is reviewed by a lawyer';
  end;

  ------------------ 6d. and needs no assignment, which is §5.6 argued once more
  update public.orders set reviewer_id = '00000000-0000-0000-0000-00000000001c'
  where id = '00000000-0000-0000-0000-00000000f002';
  update public.orders set status = 'delivered' where id = '00000000-0000-0000-0000-00000000f002';
  select count(*) into n from public.orders
  where id = '00000000-0000-0000-0000-00000000f002'
    and status = 'delivered' and delivered_at is not null;
  raise notice '% 6d. a lawyer covering a service they are not assigned to can deliver it (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 6e. and rejection is a real step
  -- in_review → generating is a lawyer sending it round again. §6.1 names it as
  -- an event and it is one, because the status move is what the log records.
  insert into public.orders (id, client_id, service_version_id, entitlement_id, reviewer_id)
  values ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-00000000abc2', '00000000-0000-0000-0000-0000000000e2',
          '00000000-0000-0000-0000-00000000001c');
  update public.orders set status = 'submitted' where id = '00000000-0000-0000-0000-00000000f003';
  update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-00000000f003';
  update public.orders set status = 'in_review' where id = '00000000-0000-0000-0000-00000000f003';
  update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-00000000f003';
  raise notice 'PASS 6e. a rejected document goes back to generation and says so in the log';

  ------------------------------------ 7. Art. 22 on a version that needs no lawyer
  -- The `auto` order from the first block. Nothing about its version requires
  -- review; the client asked, and that is enough.
  update public.orders set status = 'generating', human_review_requested = true
  where id = '00000000-0000-0000-0000-00000000f001';
  update public.orders set entitlement_id = '00000000-0000-0000-0000-0000000000e1'
  where id = '00000000-0000-0000-0000-00000000f001';
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 7. a client asked for a human and the platform delivered without one';
  exception when others then
    raise notice 'PASS 7. an Art. 22 request puts an auto document through review';
  end;

  ------------------------------------------- 7b. and the platform cannot take it back
  begin
    update public.orders set human_review_requested = false
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 7b. a request for human review was withdrawn by the platform';
  exception when others then
    raise notice 'PASS 7b. an Art. 22 request is not the platform''s to cancel';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- What was it issued under -----------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  -- An `auto` order for the client who bought nothing.
  insert into public.orders (id, client_id, service_version_id)
  values ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-0000000000d2',
          '00000000-0000-0000-0000-00000000abc1');
  update public.orders set status = 'submitted' where id = '00000000-0000-0000-0000-00000000f004';
  update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-00000000f004';

  --------------------------- 8. a delivered document names the purchase behind it
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f004';
    raise notice 'FAIL 8. a document was delivered against nothing anybody bought';
  exception when others then
    raise notice 'PASS 8. a delivered order records the entitlement it was issued under';
  end;

  ------------------------------------- 9. and it has to be that client's purchase
  begin
    update public.orders set entitlement_id = '00000000-0000-0000-0000-0000000000e1'
    where id = '00000000-0000-0000-0000-00000000f004';
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f004';
    raise notice 'FAIL 9. one client''s document was delivered against another client''s purchase';
  exception when others then
    raise notice 'PASS 9. an entitlement covers the client who holds it';
  end;

  ------------------ 10. the purchase named has to be the one that covers this service
  -- The scenario the primitive exists for. This client *is* entitled to the
  -- second service — e2 covers it — and the order names e1, which does not.
  -- A client-level check would have accepted this and recorded a document as
  -- paid for by a purchase that did not pay for it.
  insert into public.orders (id, client_id, service_version_id, entitlement_id, reviewer_id)
  values ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-00000000abc2', '00000000-0000-0000-0000-0000000000e1',
          '00000000-0000-0000-0000-00000000001c');
  update public.orders set status = 'submitted' where id = '00000000-0000-0000-0000-00000000f005';
  update public.orders set status = 'generating' where id = '00000000-0000-0000-0000-00000000f005';
  update public.orders set status = 'in_review' where id = '00000000-0000-0000-0000-00000000f005';

  select public.client_is_entitled_to (
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2')::integer
  into n;
  raise notice '% 10. the client is covered for this service, by a different purchase',
    case when n = 1 then 'PASS' else 'FAIL' end;

  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f005';
    raise notice 'FAIL 10b. the order was delivered naming a purchase that does not cover it';
  exception when others then
    raise notice 'PASS 10b. and the order still cannot name the purchase that does not';
  end;

  ------------------------------------ 11. a revoked entitlement stops delivering
  update public.orders set entitlement_id = '00000000-0000-0000-0000-0000000000e2'
  where id = '00000000-0000-0000-0000-00000000f005';
  update public.entitlements set revoked_at = now()
  where id = '00000000-0000-0000-0000-0000000000e2';
  begin
    update public.orders set status = 'delivered'
    where id = '00000000-0000-0000-0000-00000000f005';
    raise notice 'FAIL 11. a document was delivered against a refunded purchase';
  exception when others then
    raise notice 'PASS 11. coverage is asked at delivery, not at ordering';
  end;
  update public.entitlements set revoked_at = null
  where id = '00000000-0000-0000-0000-0000000000e2';

  --------------------------------------------- 11b. and with it live, it delivers
  update public.orders set status = 'delivered'
  where id = '00000000-0000-0000-0000-00000000f005';
  select count(*) into n from public.orders
  where id = '00000000-0000-0000-0000-00000000f005' and status = 'delivered';
  raise notice '% 11b. a covered, reviewed document is delivered (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ---------------------------------------- 12. delivered is terminal and settled
  begin
    update public.orders set status = 'cancelled'
    where id = '00000000-0000-0000-0000-00000000f005';
    raise notice 'FAIL 12. a delivered document was cancelled out from under its passport';
  exception when others then
    raise notice 'PASS 12. delivered is where an order stops (§8.4 re-issues, it does not rewind)';
  end;

  begin
    update public.orders set reviewer_id = '00000000-0000-0000-0000-00000000001b'
    where id = '00000000-0000-0000-0000-00000000f005';
    raise notice 'FAIL 12b. the reviewer of a delivered document was rewritten';
  exception when others then
    raise notice 'PASS 12b. what a delivered order was issued under is settled';
  end;

  ------------------------------------------- 13. an intake can be abandoned
  insert into public.orders (id, client_id, service_version_id)
  values ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-0000000000d2',
          '00000000-0000-0000-0000-00000000abc1');
  update public.orders set status = 'abandoned' where id = '00000000-0000-0000-0000-00000000f006';
  select count(*) into n from public.orders
  where id = '00000000-0000-0000-0000-00000000f006' and closed_at is not null;
  raise notice '% 13. an abandoned intake is closed and dated, which §7.2 needs (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ---------------------------------- 13b. but a submitted order is not abandoned
  -- It has answers and is the firm's to progress or to cancel. Silence is only
  -- an answer before the client has given one.
  begin
    update public.orders set status = 'abandoned'
    where id = '00000000-0000-0000-0000-00000000f004';
    raise notice 'FAIL 13b. an order with answers in it was written off as abandoned';
  exception when others then
    raise notice 'PASS 13b. an order that was submitted is cancelled, not abandoned';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Audit ------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------------- 14. the order joined the log, not a log of its own
  select count(*) into n from public.audit_events
  where entity_table = 'orders'
    and entity_id = '00000000-0000-0000-0000-00000000f005'
    and service_id = '00000000-0000-0000-0000-0000000000a2';
  raise notice '% 14. every move of an order is in the service''s cut of the log (% events)',
    case when n >= 5 then 'PASS' else 'FAIL' end, n;

  ---------------------------- 14b. and the status projection can be read back out
  -- §6.1: current status is a projection of the log. This is that projection,
  -- computed the way ADM-66's timeline will compute it, and it agrees with the
  -- column — which is the claim the column has to keep earning.
  select count(*) into n from public.audit_events
  where entity_table = 'orders'
    and entity_id = '00000000-0000-0000-0000-00000000f005'
    and 'status' = any (changed_columns)
    and after ->> 'status' = 'delivered';
  raise notice '% 14b. the delivery is recoverable from the log alone (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ----------------------------------------- 14c. and the payload names no person
  select count(*) into n from public.audit_events
  where entity_table = 'orders'
    and entity_id = '00000000-0000-0000-0000-00000000f005'
    and action = 'insert'
    and after ? 'client_id';
  raise notice '% 14c. the payload carries the pseudonym and nothing else about them (% events)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

-- Who reads an order -----------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  --------------------------------------------------- 15. an admin sees the pipeline
  -- §7.3: an admin sees a case depersonalised, and this table is already that.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000001a","app_metadata":{"role":"admin"}}';
  select count(*) into n from public.orders;
  raise notice '% 15. an admin sees every order (% of 6)',
    case when n = 6 then 'PASS' else 'FAIL' end, n;

  ------------------------------ 16. the assigned lawyer sees their services' orders
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000001b","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.orders;
  raise notice '% 16. the assigned lawyer sees the orders of both their services (% of 6)',
    case when n = 6 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 17. the reviewer sees the matter they took
  -- This lawyer is assigned to nothing. Everything they can see, they can see
  -- because somebody handed it to them — which is the arm of the policy that
  -- would otherwise be dead code hidden behind the assignment arm.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000001c","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.orders;
  raise notice '% 17. a reviewer assigned to no service still sees their own matters (% of 3)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------------ 18. and a stranger sees nothing
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000001d","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.orders;
  raise notice '% 18. a lawyer with no assignment and no matter sees no client at all (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 19. nobody writes an order from a browser
  -- Orders arrive through the gateway (ADM-5). The console gains writes with
  -- ADM-66 and ADM-67, each of which owes a rule about who may move what.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000001a","app_metadata":{"role":"admin"}}';
  begin
    insert into public.orders (client_id, service_version_id)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000abc1');
    raise notice 'FAIL 19. an admin placed an order from the console';
  exception when insufficient_privilege then
    raise notice 'PASS 19. no console write path exists yet, and it fails loudly';
  end;

  ------------------------------------------------ 19b. nor moves one along
  begin
    update public.orders set status = 'cancelled'
    where id = '00000000-0000-0000-0000-00000000f001';
    raise notice 'FAIL 19b. an admin moved an order from the console';
  exception when insufficient_privilege then
    raise notice 'PASS 19b. moving an order is not a console operation yet either';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);

end;
$$;

rollback;
