-- Verification scenarios for 20260815140000_law_norm_register.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_law_refs.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Four things these scenarios are built around:
--
--   * **"Watched once" is the claim, so the duplicate is the test.** §9.3 is a
--     unique constraint here, and the case that actually needed writing is the
--     act-scoped pair: `article` is null on both, and without
--     `nulls not distinct` two rows for one act would both be accepted while
--     the constraint looked present.
--   * **The cadence cap is checked twice, because it is enforced twice.** The
--     trigger refuses what it can see; `effective_probe_interval` covers the
--     ordering no trigger on these tables can see — a service being *published*
--     after the dependency already exists. Scenario 13 builds exactly that
--     sequence, and it is the reason the derived function exists.
--   * **Denials are separated by how they fail.** A missing grant raises; a
--     policy `using` clause writes nothing and says nothing. Asserting the
--     second by looking for an exception would pass while the rule did nothing,
--     so those scenarios count rows.
--   * **Both roles read the whole register, and that is deliberate rather than
--     an oversight** (§4.11). The scenarios prove it on purpose so that nobody
--     "tightens" it later without meeting this line.
--
-- The counts are scoped to this script's own fixtures — every one uses the
-- `00000000-` prefix — because a script that assumes an empty baseline fails on
-- the seed rather than on the schema.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000f001a', 'law-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000f001b', 'law-assigned@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000f001c', 'law-stranger@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000f001d', 'law-second@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000f001a';
update public.profiles set role = 'lawyer', full_name = 'The Assigned Lawyer'
where id = '00000000-0000-0000-0000-0000000f001b';
update public.profiles set role = 'lawyer', full_name = 'A Stranger'
where id = '00000000-0000-0000-0000-0000000f001c';
update public.profiles set role = 'lawyer', full_name = 'The Second Lawyer'
where id = '00000000-0000-0000-0000-0000000f001d';

-- Two services. The first is on sale, the second exists only as a draft — which
-- is the axis the whole cadence half of this file turns on.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000fa001', 'divorce-petition', 'Divorce petition', 'family'),
  ('00000000-0000-0000-0000-0000000fa002', 'draft-only-service', 'Draft only', 'property');

-- Each service has its own primary lawyer, and they are different people. The
-- second service needs one because scenario 13 publishes a version of it, and
-- publication refuses a service with nobody accountable for it; it must not be
-- the first lawyer, because scenario 25 turns on their *not* answering for it.
insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000fa001', '00000000-0000-0000-0000-0000000f001b', true),
  ('00000000-0000-0000-0000-0000000fa002', '00000000-0000-0000-0000-0000000f001d', true);

insert into public.service_versions (id, service_id, version, status, generation_mode, review_mode) values
  ('00000000-0000-0000-0000-0000000fb001', '00000000-0000-0000-0000-0000000fa001', 1,
   'published', 'template', 'auto'),
  ('00000000-0000-0000-0000-0000000fb002', '00000000-0000-0000-0000-0000000fa002', 1,
   'draft', 'template', 'auto');

-- Article 105 of the Family Code, watched by the service on sale.
insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url) values
  ('00000000-0000-0000-0000-0000000fc001', 'zakon_rada', '2947-14', 'Сімейний кодекс України', '105',
   'https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101#n800',
   'https://zakon.rada.gov.ua/laws/show/2947-14');

insert into public.service_law_refs (id, service_id, norm_id, relied_on) values
  ('00000000-0000-0000-0000-0000000fd001', '00000000-0000-0000-0000-0000000fa001',
   '00000000-0000-0000-0000-0000000fc001', 'grounds for dissolution of marriage');

-- Watched once -----------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------------------------------- 1. one norm, one row
  begin
    insert into public.law_norms (source, act_id, act_title, article, source_url, canonical_url)
    values ('zakon_rada', '2947-14', 'Сімейний кодекс України', '105',
            'https://zakon.rada.gov.ua/laws/show/2947-14',
            'https://zakon.rada.gov.ua/laws/show/2947-14');
    raise notice 'FAIL 1. one article was entered into the register twice (§9.3)';
  exception when unique_violation then
    raise notice 'PASS 1. an article already watched is not watched a second time';
  end;

  ---------------------- 1b. and the act-scoped pair, where article is null on both
  insert into public.law_norms (source, act_id, act_title, scope, act_scope_reason,
                                source_url, canonical_url)
  values ('zakon_rada', '435-15', 'Цивільний кодекс України', 'act',
          'the block rests on the act as a whole', 'https://zakon.rada.gov.ua/laws/show/435-15',
          'https://zakon.rada.gov.ua/laws/show/435-15');
  begin
    insert into public.law_norms (source, act_id, act_title, scope, act_scope_reason,
                                  source_url, canonical_url)
    values ('zakon_rada', '435-15', 'Цивільний кодекс України', 'act',
            'a second opinion about the same act', 'https://zakon.rada.gov.ua/laws/show/435-15',
            'https://zakon.rada.gov.ua/laws/show/435-15');
    raise notice 'FAIL 1b. two act-level rows for one act — `nulls not distinct` is not doing its job';
  exception when unique_violation then
    raise notice 'PASS 1b. two act-level rows for one act collide, null article and all';
  end;

  ------------------------------ 1c. a different article of the same act is a norm
  insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url)
  values ('00000000-0000-0000-0000-0000000fc002', 'zakon_rada', '2947-14',
          'Сімейний кодекс України', '112',
          'https://zakon.rada.gov.ua/laws/show/2947-14',
          'https://zakon.rada.gov.ua/laws/show/2947-14');
  select count(*) into n from public.law_norms
  where act_id = '2947-14' and id::text like '00000000-%';
  raise notice '% 1c. two articles of one act are two norms (%)',
    case when n = 2 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The article is the unit (§9.4) --------------------------------------------------

do $$
begin
  set local role postgres;

  ------------------------------------- 2. an article-scoped norm names an article
  begin
    insert into public.law_norms (source, act_id, act_title, scope, source_url, canonical_url)
    values ('zakon_rada', '1111-11', 'An act', 'article',
            'https://zakon.rada.gov.ua/laws/show/1111-11',
            'https://zakon.rada.gov.ua/laws/show/1111-11');
    raise notice 'FAIL 2. an article-scoped norm was stored with no article';
  exception when check_violation then
    raise notice 'PASS 2. an article-scoped norm without an article is refused';
  end;

  ------------------------------------------ 3. an act-scoped norm names no article
  begin
    insert into public.law_norms (source, act_id, act_title, scope, article, act_scope_reason,
                                  source_url, canonical_url)
    values ('zakon_rada', '1111-12', 'An act', 'act', '5', 'whole act',
            'https://zakon.rada.gov.ua/laws/show/1111-12',
            'https://zakon.rada.gov.ua/laws/show/1111-12');
    raise notice 'FAIL 3. a norm claimed to cover a whole act and named one article of it';
  exception when check_violation then
    raise notice 'PASS 3. an act-scoped norm carrying an article is refused';
  end;

  --------------------------- 4. act-level tracking is a *justified* exception
  begin
    insert into public.law_norms (source, act_id, act_title, scope, source_url, canonical_url)
    values ('zakon_rada', '1111-13', 'An act', 'act',
            'https://zakon.rada.gov.ua/laws/show/1111-13',
            'https://zakon.rada.gov.ua/laws/show/1111-13');
    raise notice 'FAIL 4. a whole act is being watched and nobody said why (§9.4)';
  exception when check_violation then
    raise notice 'PASS 4. act-level tracking without a recorded reason is refused';
  end;

  ---------------------- 5. and the reason belongs only to the exception it explains
  begin
    insert into public.law_norms (source, act_id, act_title, article, act_scope_reason,
                                  source_url, canonical_url)
    values ('zakon_rada', '1111-14', 'An act', '7', 'a reason for a choice not made',
            'https://zakon.rada.gov.ua/laws/show/1111-14',
            'https://zakon.rada.gov.ua/laws/show/1111-14');
    raise notice 'FAIL 5. an article-scoped norm carries a justification for act-level tracking';
  exception when check_violation then
    raise notice 'PASS 5. an act-scope reason on an article-scoped norm is refused';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Cadence (§9.8) ------------------------------------------------------------------

do $$
declare
  v_interval interval;
  v_effective interval;
begin
  set local role postgres;

  --------------------- 6. taking the recommendation costs no explanation
  insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url)
  values ('00000000-0000-0000-0000-0000000fc003', 'zakon_rada', '2222-22', 'Another act', '3',
          'https://zakon.rada.gov.ua/laws/show/2222-22',
          'https://zakon.rada.gov.ua/laws/show/2222-22');
  select probe_interval into v_interval from public.law_norms
  where id = '00000000-0000-0000-0000-0000000fc003';
  raise notice '% 6. a norm with no dependencies takes the weekly recommendation (%)',
    case when v_interval = interval '7 days' then 'PASS' else 'FAIL' end, v_interval;

  ------------------------------------ 7. departing from it does not
  begin
    update public.law_norms set probe_interval = interval '3 days'
    where id = '00000000-0000-0000-0000-0000000fc003';
    raise notice 'FAIL 7. a non-default interval was accepted with no rationale (§9.8)';
  exception when raise_exception then
    raise notice 'PASS 7. a non-default interval without a reason is refused';
  end;

  ------------------------------------------------- 8. with a sentence, it is fine
  update public.law_norms
  set probe_interval = interval '3 days', interval_reason = 'amended twice this year'
  where id = '00000000-0000-0000-0000-0000000fc003';
  select probe_interval into v_interval from public.law_norms
  where id = '00000000-0000-0000-0000-0000000fc003';
  raise notice '% 8. a non-default interval with its reason is accepted (%)',
    case when v_interval = interval '3 days' then 'PASS' else 'FAIL' end, v_interval;

  ------------------------------------------- 8b. editing something else is free
  -- The recommendation moves on its own when a dependent service is published.
  -- If the guard compared against it on every write, this rename would demand a
  -- rationale from somebody who chose nothing.
  update public.law_norms set act_title = 'Another act, renamed'
  where id = '00000000-0000-0000-0000-0000000fc003';
  raise notice 'PASS 8b. an edit that leaves the cadence alone is not asked to justify it';

  ------------------------------------------------- 9. time runs forwards
  begin
    update public.law_norms
    set probe_interval = interval '0 seconds', interval_reason = 'never, ideally'
    where id = '00000000-0000-0000-0000-0000000fc003';
    raise notice 'FAIL 9. a norm is on a zero-length probe interval';
  exception when raise_exception then
    raise notice 'PASS 9. a non-positive probe interval is refused';
  end;

  --------------- 10. a norm behind a service on sale cannot be slowed past the cap
  begin
    update public.law_norms
    set probe_interval = interval '30 days', interval_reason = 'it never changes'
    where id = '00000000-0000-0000-0000-0000000fc001';
    raise notice 'FAIL 10. a norm behind a published service was set to a monthly probe (§9.8)';
  exception when raise_exception then
    raise notice 'PASS 10. the operating maximum refuses a slower probe on a live norm';
  end;

  ------------------------------------------- 11. and can always be tightened
  update public.law_norms
  set probe_interval = interval '6 hours', interval_reason = 'amended during the reform'
  where id = '00000000-0000-0000-0000-0000000fc001';
  select probe_interval into v_interval from public.law_norms
  where id = '00000000-0000-0000-0000-0000000fc001';
  raise notice '% 11. a live norm can be watched more closely, with a reason (%)',
    case when v_interval = interval '6 hours' then 'PASS' else 'FAIL' end, v_interval;

  ------- 12. and a live service cannot come to depend on a slowly-probed norm
  -- A norm nothing on sale depends on may be probed monthly; that is the whole
  -- point of the recommendation being per norm. What the guard refuses is the
  -- *attachment* that would put it behind a live service.
  insert into public.law_norms (id, source, act_id, act_title, article,
                                probe_interval, interval_reason, source_url, canonical_url)
  values ('00000000-0000-0000-0000-0000000fc006', 'zakon_rada', '5555-55', 'A slow act', '2',
          interval '30 days', 'nothing on sale leans on it',
          'https://zakon.rada.gov.ua/laws/show/5555-55',
          'https://zakon.rada.gov.ua/laws/show/5555-55');

  select probe_interval into v_interval from public.law_norms
  where id = '00000000-0000-0000-0000-0000000fc006';
  raise notice '% 12a. a norm nothing sells against may be probed monthly (%)',
    case when v_interval = interval '30 days' then 'PASS' else 'FAIL' end, v_interval;

  begin
    insert into public.service_law_refs (service_id, norm_id, relied_on)
    values ('00000000-0000-0000-0000-0000000fa001', '00000000-0000-0000-0000-0000000fc006',
            'something the published service leans on');
    raise notice 'FAIL 12b. a service on sale now depends on a monthly-probed norm, unchecked';
  exception when raise_exception then
    raise notice 'PASS 12b. attaching a live service to a norm past the cap is refused';
  end;

  ---- 13. THE ORDERING NO TRIGGER ON THESE TABLES CAN SEE: publish, afterwards.
  -- The dependency is attached while the service is a draft, which is allowed
  -- and correct. Then a version of it is published — a write to neither table —
  -- and the stored interval is suddenly a promise nobody checked. This is why
  -- the cap is also derived on read.
  insert into public.law_norms (id, source, act_id, act_title, article,
                                probe_interval, interval_reason, source_url, canonical_url)
  values ('00000000-0000-0000-0000-0000000fc004', 'zakon_rada', '3333-33', 'A third act', '9',
          interval '30 days', 'only a draft leans on it',
          'https://zakon.rada.gov.ua/laws/show/3333-33',
          'https://zakon.rada.gov.ua/laws/show/3333-33');
  insert into public.service_law_refs (service_id, norm_id, relied_on)
  values ('00000000-0000-0000-0000-0000000fa002', '00000000-0000-0000-0000-0000000fc004',
          'the draft service leans on this');

  select public.effective_probe_interval ('00000000-0000-0000-0000-0000000fc004')
  into v_effective;
  raise notice '% 13a. while only a draft depends on it, the stored interval stands (%)',
    case when v_effective = interval '30 days' then 'PASS' else 'FAIL' end, v_effective;

  insert into public.service_versions (service_id, version, status, generation_mode, review_mode)
  values ('00000000-0000-0000-0000-0000000fa002', 2, 'published', 'template', 'auto');

  select probe_interval into v_interval from public.law_norms
  where id = '00000000-0000-0000-0000-0000000fc004';
  select public.effective_probe_interval ('00000000-0000-0000-0000-0000000fc004')
  into v_effective;
  raise notice '% 13b. once it goes on sale the cap binds without anyone touching the norm (stored %, honoured %)',
    case when v_interval = interval '30 days' and v_effective = public.max_probe_interval ()
      then 'PASS' else 'FAIL' end, v_interval, v_effective;

  ------------------------- 14. the recommendation follows what a norm is for
  raise notice '% 14. a norm behind a published service is recommended a daily probe (%)',
    case when public.recommended_probe_interval ('00000000-0000-0000-0000-0000000fc001')
      = interval '1 day' then 'PASS' else 'FAIL' end,
    public.recommended_probe_interval ('00000000-0000-0000-0000-0000000fc001');

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The dependency ------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  --------------------------------- 15. a dependency says what it is depended on for
  begin
    insert into public.service_law_refs (service_id, norm_id, relied_on)
    values ('00000000-0000-0000-0000-0000000fa001', '00000000-0000-0000-0000-0000000fc002', '   ');
    raise notice 'FAIL 15. a dependency was recorded with a blank sentence (§9.5.6)';
  exception when check_violation then
    raise notice 'PASS 15. a dependency with nothing written on it is refused';
  end;

  ------------------------------------------------ 16. one service, one norm, once
  begin
    insert into public.service_law_refs (service_id, norm_id, relied_on)
    values ('00000000-0000-0000-0000-0000000fa001', '00000000-0000-0000-0000-0000000fc001',
            'the same norm again');
    raise notice 'FAIL 16. one service depends on one norm twice';
  exception when unique_violation then
    raise notice 'PASS 16. a service does not record the same dependency twice';
  end;

  -------------------------------------- 17. a norm in use cannot be deleted
  begin
    delete from public.law_norms where id = '00000000-0000-0000-0000-0000000fc001';
    raise notice 'FAIL 17. a norm was deleted out from under the service depending on it';
  exception when foreign_key_violation then
    raise notice 'PASS 17. a norm something depends on cannot be deleted';
  end;

  -------------- 18. and dropping the dependency is a delete of the dependency
  select count(*) into n from public.service_law_refs
  where norm_id = '00000000-0000-0000-0000-0000000fc001';
  raise notice '% 18. the dependency survived the attempt on the norm (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Who may read, and who may write -------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------------------------ 19. an admin reads the register
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f001a","app_metadata":{"role":"admin"}}';
  select count(*) into n from public.law_norms where id::text like '00000000-0000-0000-0000-0000000fc%';
  raise notice '% 19. an admin reads the register (% norms)',
    case when n = 5 then 'PASS' else 'FAIL' end, n;

  --------- 20. and so does a lawyer, including norms no service of theirs cites
  -- §4.11 shows a norm once with every dependent service against it. That screen
  -- cannot be built from rows filtered to the reader's own assignments, and this
  -- scenario is here so nobody narrows the policy without meeting the reason.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f001c","app_metadata":{"role":"lawyer"}}';
  select count(*) into n from public.law_norms where id::text like '00000000-0000-0000-0000-0000000fc%';
  raise notice '% 20. a lawyer assigned to nothing still reads the whole register (%)',
    case when n = 5 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 21. a lawyer may extend the register
  insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url)
  values ('00000000-0000-0000-0000-0000000fc005', 'zakon_rada', '4444-44', 'A fourth act', '1',
          'https://zakon.rada.gov.ua/laws/show/4444-44',
          'https://zakon.rada.gov.ua/laws/show/4444-44');
  raise notice 'PASS 21. a lawyer adds a norm — a register only an admin may extend stays empty';

  ------- 22. but not edit one that belongs to a service they do not answer for
  update public.law_norms set act_title = 'Renamed by a stranger'
  where id = '00000000-0000-0000-0000-0000000fc001';
  get diagnostics n = row_count;
  raise notice '% 22. a lawyer outside the dependent services changes nothing, silently (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  --------------------------------- 23. the assigned lawyer may
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f001b","app_metadata":{"role":"lawyer"}}';
  update public.law_norms set act_title = 'Сімейний кодекс України (ред.)'
  where id = '00000000-0000-0000-0000-0000000fc001';
  get diagnostics n = row_count;
  raise notice '% 23. a lawyer assigned to a service depending on the norm may edit it (% rows)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------- 24. and may say what their service rests on
  insert into public.service_law_refs (service_id, norm_id, relied_on)
  values ('00000000-0000-0000-0000-0000000fa001', '00000000-0000-0000-0000-0000000fc002',
          'the second article this service leans on');
  raise notice 'PASS 24. an assigned lawyer records a dependency for their own service';

  ----------------------- 25. but not for somebody else's — and this one raises
  begin
    insert into public.service_law_refs (service_id, norm_id, relied_on)
    values ('00000000-0000-0000-0000-0000000fa002', '00000000-0000-0000-0000-0000000fc002',
            'a service they do not answer for');
    raise notice 'FAIL 25. a lawyer wrote a dependency onto a service they are not assigned to';
  exception when insufficient_privilege then
    raise notice 'PASS 25. a dependency on an unassigned service is refused by the check';
  end;

  ------------------------------- 26. an admin writes across services
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f001a","app_metadata":{"role":"admin"}}';
  insert into public.service_law_refs (service_id, norm_id, relied_on)
  values ('00000000-0000-0000-0000-0000000fa002', '00000000-0000-0000-0000-0000000fc002',
          'an admin attaching a norm to any service');
  raise notice 'PASS 26. an admin records a dependency for any service';

  ---------------------------- 27. nobody deletes from the register at all
  -- Loud rather than silent: the grant is withheld, and `law_norms` has no
  -- authorised deleter inside `authenticated` for the refusal to hide behind.
  begin
    delete from public.law_norms where id = '00000000-0000-0000-0000-0000000fc005';
    raise notice 'FAIL 27. a norm was deleted from the register through the console role';
  exception when insufficient_privilege then
    raise notice 'PASS 27. no console role may delete a norm — the history outlives the dependency';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The log -------------------------------------------------------------------------

do $$
declare
  v_service uuid;
  n integer;
begin
  set local role postgres;

  ------------ 28. a dependency is one service's business, so the log says which
  select service_id into v_service from public.audit_events
  where entity_table = 'service_law_refs'
    and entity_id = '00000000-0000-0000-0000-0000000fd001'
  order by occurred_at limit 1;
  raise notice '% 28. a dependency event names the service it belongs to (%)',
    case when v_service = '00000000-0000-0000-0000-0000000fa001' then 'PASS' else 'FAIL' end,
    coalesce(v_service::text, 'null');

  --------- 29. the register belongs to no service, so the log honestly says none
  select count(*) into n from public.audit_events
  where entity_table = 'law_norms'
    and entity_id = '00000000-0000-0000-0000-0000000fc001'
    and service_id is null;
  raise notice '% 29. register events carry no service_id — ten services may share one norm (%)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
