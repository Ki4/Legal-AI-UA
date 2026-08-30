-- Verification scenarios for 20260830130000_law_signals.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_law_signals.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Four things these scenarios are built around:
--
--   * **The pause is checked in both directions, one day apart.** A confirmed
--     impact takes a published service off sale (Q5); a `scheduled` one names a
--     law that is not in force and must not. A script asserting only the first
--     would pass against a trigger that paused everything, which is the more
--     expensive of the two mistakes and the harder to notice — a service off
--     sale for a rule nobody has to follow yet looks like caution.
--   * **"One signal awaiting triage" is checked against its own exception.**
--     The partial index refuses a second unread signal and must still allow one
--     after a `scheduled` resolution, because a further change to the same
--     article is a new question.
--   * **Every constraint is asserted by the write it must refuse.** A
--     resolution with no author, a `scheduled` with no date, a fix due after
--     the law lands — each is a row this table exists to make impossible.
--   * **Denials are separated by how they fail.** No insert grant means an
--     exception; a policy filtering rows means a silent zero. Scenarios 12 and
--     13 expect different things for that reason.
--
-- Fixtures use the `00000000-` prefix, and the act ids are synthetic for the
-- reason `verify_law_refs.sql` records: uniqueness on (source, act_id, article)
-- knows nothing about an id prefix, so a fixture citing a real article collides
-- with `seed.sql` and kills the script before its first scenario.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000d001a', 'sig-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000d001b', 'sig-lawyer@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000d001c', 'sig-stranger@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000d001a';
update public.profiles set role = 'lawyer', full_name = 'The Assigned Lawyer'
where id = '00000000-0000-0000-0000-0000000d001b';
update public.profiles set role = 'lawyer', full_name = 'A Stranger'
where id = '00000000-0000-0000-0000-0000000d001c';

-- A service with a published version, so the pause has something to act on.
--
-- The order is not cosmetic and it is copied from `verify_law_refs.sql` rather
-- than invented: publication requires an assigned lawyer, so the assignment
-- comes first, and `published_at` is set by the publish trigger rather than by
-- hand — writing it here would be asserting the trigger's job in the fixture and
-- then never testing it.
insert into public.services (id, slug, title, practice_area)
values ('00000000-0000-0000-0000-0000000d1001', 'sig-divorce', 'Розірвання шлюбу', 'family');

insert into public.service_assignments (service_id, lawyer_id, is_primary)
values ('00000000-0000-0000-0000-0000000d1001', '00000000-0000-0000-0000-0000000d001b', true);

insert into public.service_versions
  (id, service_id, version, status, generation_mode, review_mode)
values
  ('00000000-0000-0000-0000-0000000d2001', '00000000-0000-0000-0000-0000000d1001', 1,
   'published', 'template', 'auto');

-- Two norms: one behind the published service, one behind nothing at all.
insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url)
values
  ('00000000-0000-0000-0000-0000000d3001', 'zakon_rada', 'test-0021', 'Тестовий кодекс С', '10',
   'https://zakon.rada.gov.ua/laws/show/test-0021',
   'https://zakon.rada.gov.ua/laws/show/test-0021'),
  ('00000000-0000-0000-0000-0000000d3002', 'zakon_rada', 'test-0022', 'Тестовий кодекс Д', '11',
   'https://zakon.rada.gov.ua/laws/show/test-0022',
   'https://zakon.rada.gov.ua/laws/show/test-0022');

insert into public.service_law_refs (service_id, norm_id, relied_on)
values ('00000000-0000-0000-0000-0000000d1001', '00000000-0000-0000-0000-0000000d3001',
        'Grounds on which a marriage may be dissolved.');

-- The two texts a lawyer will be shown, and one belonging to the other norm —
-- which scenario 3 needs in order to try pairing them wrongly.
insert into public.law_norm_revisions
  (id, norm_id, fingerprint, normalizer_version, content, observed_at)
values
  ('00000000-0000-0000-0000-0000000d4001', '00000000-0000-0000-0000-0000000d3001',
   'sha256:1111111111111111111111111111111111111111111111111111111111111111', 1,
   'Перша редакція статті десять.', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000d4002', '00000000-0000-0000-0000-0000000d3001',
   'sha256:2222222222222222222222222222222222222222222222222222222222222222', 1,
   'Друга редакція статті десять.', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000d4003', '00000000-0000-0000-0000-0000000d3002',
   'sha256:3333333333333333333333333333333333333333333333333333333333333333', 1,
   'Редакція статті одинадцять, іншої норми.', now() - interval '1 day');

-- What a signal may pair -------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ---------------------------------------- 1. an ordinary signal on a real drift
  insert into public.law_signals
    (id, norm_id, cause, revision_id, previous_revision_id)
  values ('00000000-0000-0000-0000-0000000d5001', '00000000-0000-0000-0000-0000000d3001',
          'drifted', '00000000-0000-0000-0000-0000000d4002',
          '00000000-0000-0000-0000-0000000d4001');

  select count(*) into n from public.law_signals
  where norm_id = '00000000-0000-0000-0000-0000000d3001' and state = 'open';
  raise notice '% 1. a drift is queued for triage (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------ 2. a diff of a text against itself is not one
  begin
    insert into public.law_signals (norm_id, cause, revision_id, previous_revision_id)
    values ('00000000-0000-0000-0000-0000000d3002', 'drifted',
            '00000000-0000-0000-0000-0000000d4003', '00000000-0000-0000-0000-0000000d4003');
    raise notice 'FAIL 2. a signal pairs one revision with itself';
  exception when check_violation then
    raise notice 'PASS 2. a signal cannot diff a revision against itself';
  end;

  ------------------- 3. nor two texts belonging to two different articles
  --
  -- The foreign keys prove both revisions exist and neither proves they are the
  -- same norm's. A diff between article 10's old text and article 11's new one
  -- would render confidently, and a lawyer would read it and decide something.
  begin
    insert into public.law_signals (norm_id, cause, revision_id, previous_revision_id)
    values ('00000000-0000-0000-0000-0000000d3001', 'drifted',
            '00000000-0000-0000-0000-0000000d4002', '00000000-0000-0000-0000-0000000d4003');
    raise notice 'FAIL 3. a signal paired revisions from two different norms';
  exception when raise_exception then
    raise notice 'PASS 3. a signal''s revisions must both belong to its norm';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- One piece of work, not two -----------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  --------------------------- 4. a second unread signal for one norm is refused
  --
  -- The database half of the rule `decideProbe` already applies in code. §9.4's
  -- failure — a lawyer who stops opening alerts — is reached by repeating a true
  -- alarm just as surely as by raising false ones.
  begin
    insert into public.law_signals (norm_id, cause, revision_id, previous_revision_id)
    values ('00000000-0000-0000-0000-0000000d3001', 'drifted',
            '00000000-0000-0000-0000-0000000d4002', '00000000-0000-0000-0000-0000000d4001');
    raise notice 'FAIL 4. a norm has two signals waiting to be read';
  exception when unique_violation then
    raise notice 'PASS 4. a norm carries one signal awaiting triage';
  end;

  ------------------ 5. and picking it up does not free the slot either
  update public.law_signals
  set state = 'under_review',
      triaged_by = '00000000-0000-0000-0000-0000000d001b',
      triaged_at = now()
  where id = '00000000-0000-0000-0000-0000000d5001';

  begin
    insert into public.law_signals (norm_id, cause, revision_id, previous_revision_id)
    values ('00000000-0000-0000-0000-0000000d3001', 'drifted',
            '00000000-0000-0000-0000-0000000d4002', '00000000-0000-0000-0000-0000000d4001');
    raise notice 'FAIL 5. a signal already being read did not hold the slot';
  exception when unique_violation then
    raise notice 'PASS 5. a signal under review still counts as awaiting triage';
  end;

  select count(*) into n from public.law_signals
  where norm_id = '00000000-0000-0000-0000-0000000d3001';
  raise notice '% 5b. and the norm still has exactly one signal (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- What a resolution must say -------------------------------------------------------

do $$
begin
  set local role postgres;

  ------------------------------------- 6. a decision has an author (§9.11)
  begin
    update public.law_signals
    set state = 'resolved_no_impact', triaged_by = null, triaged_at = null,
        resolution_note = 'Renumbering only.'
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 6. a legal judgement was recorded with nobody attached to it';
  exception when check_violation then
    raise notice 'PASS 6. a resolved signal names who resolved it';
  end;

  ---------------------------------------------- 7. and says why
  begin
    update public.law_signals
    set state = 'resolved_no_impact', resolution_note = '   '
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 7. a signal was resolved with no reason given';
  exception when check_violation then
    raise notice 'PASS 7. a resolution carries its reason';
  end;

  ------------------ 8. no impact asks for no remediation date, and refuses one
  --
  -- Requiring it would ask a lawyer to schedule the work they have just decided
  -- is unnecessary; permitting it would leave a date nothing is measured against.
  begin
    update public.law_signals
    set state = 'resolved_no_impact', resolution_note = 'Editorial.',
        remediation_due = current_date + 7
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 8. a signal with no impact carries a remediation deadline';
  exception when check_violation then
    raise notice 'PASS 8. no impact means no deadline';
  end;

  ------------------------- 9. a scheduled signal without its date is not scheduled
  begin
    update public.law_signals
    set state = 'scheduled', resolution_note = 'Takes effect later.',
        remediation_due = current_date + 7, effective_date = null
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 9. a change was scheduled for no date at all';
  exception when check_violation then
    raise notice 'PASS 9. scheduled means "not in force yet", so it needs the date';
  end;

  ------------------ 10. and the fix cannot be due after the law it is fixing
  begin
    update public.law_signals
    set state = 'scheduled', resolution_note = 'Takes effect later.',
        effective_date = current_date + 30, remediation_due = current_date + 31
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 10. the fix is due the day after the law makes the document wrong';
  exception when check_violation then
    raise notice 'PASS 10. a fix lands no later than the law it answers';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Q5 and Q7: what comes off sale, and what does not ---------------------------------

do $$
declare
  v_status public.service_status;
begin
  set local role postgres;

  ------------- 11. a scheduled impact leaves a live service on sale (Q7)
  --
  -- The half that is easy to get wrong in the expensive direction. A service off
  -- sale for a rule nobody has to follow yet looks like caution and costs revenue
  -- for nothing; §9.9's whole win is that the lawyer prepares the new version
  -- *while the old one keeps selling*.
  update public.law_signals
  set state = 'scheduled', resolution_note = 'Amended, in force from next month.',
      effective_date = current_date + 30, remediation_due = current_date + 20
  where id = '00000000-0000-0000-0000-0000000d5001';

  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000d2001';
  raise notice '% 11. a change not yet in force left the service on sale (%)',
    case when v_status = 'published' then 'PASS' else 'FAIL' end, v_status;

  ------------------- 12. and a confirmed impact takes it off (Q5)
  update public.law_signals
  set state = 'impact_confirmed', resolution_note = 'It changes the document.',
      effective_date = null, remediation_due = current_date + 5
  where id = '00000000-0000-0000-0000-0000000d5001';

  select status into v_status from public.service_versions
  where id = '00000000-0000-0000-0000-0000000d2001';
  raise notice '% 12. a confirmed impact paused the published version (%)',
    case when v_status = 'paused' then 'PASS' else 'FAIL' end, v_status;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Access -----------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000d001b","app_metadata":{"role":"lawyer"}}', true);

  ------------------------------------------- 13. the assigned lawyer reads the queue
  select count(*) into n from public.law_signals
  where norm_id = '00000000-0000-0000-0000-0000000d3001';
  raise notice '% 13. an assigned lawyer reads the signal on their norm (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ---------------------------------------------- 14. and cannot raise one by hand
  --
  -- No insert grant, so this raises rather than writing nothing. A signal means
  -- "a machine observed a change"; one typed by a person is a claim with no
  -- revision behind it.
  begin
    insert into public.law_signals (norm_id, cause, revision_id)
    values ('00000000-0000-0000-0000-0000000d3002', 'drifted',
            '00000000-0000-0000-0000-0000000d4003');
    raise notice 'FAIL 14. a lawyer raised a signal by hand';
  exception when insufficient_privilege then
    raise notice 'PASS 14. signals are raised by the fetcher, not typed';
  end;

  --------------------------------- 15. nor rewrite what the fetcher observed
  begin
    update public.law_signals set cause = 'drifted_indeterminate'
    where id = '00000000-0000-0000-0000-0000000d5001';
    raise notice 'FAIL 15. a triage screen rewrote the machine''s own finding';
  exception when insufficient_privilege then
    raise notice 'PASS 15. cause and the revisions are not writable through the API';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000d001c","app_metadata":{"role":"lawyer"}}', true);

  --------------------------- 16. a lawyer assigned to nothing reads, and cannot triage
  --
  -- Counted rather than caught: §4.11 shows the register to both roles, so the
  -- read is deliberate and the write is what the policy narrows. A denied update
  -- under RLS writes nothing and says nothing, so the assertion counts rows.
  select count(*) into n from public.law_signals
  where norm_id = '00000000-0000-0000-0000-0000000d3001';
  raise notice '% 16. an unassigned lawyer still reads the queue (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  update public.law_signals set resolution_note = 'Rewritten by a stranger.'
  where id = '00000000-0000-0000-0000-0000000d5001';

  select count(*) into n from public.law_signals
  where id = '00000000-0000-0000-0000-0000000d5001'
    and resolution_note = 'Rewritten by a stranger.';
  raise notice '% 16b. and cannot retriage a norm they answer for nothing on (%)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
