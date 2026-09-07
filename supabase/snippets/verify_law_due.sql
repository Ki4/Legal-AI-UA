-- Verification scenarios for 20260907120000_law_norms_due_for_probe.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_law_due.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- The batch is a query, so almost every claim about it is a claim about which
-- rows it leaves out — and a query that returns nothing satisfies every one of
-- those. So each exclusion here is asserted **in both halves**: the row that
-- must be absent, and the row one field away from it that must be present. A
-- function with `where false` would pass half of this file and fail the other.
--
-- Four things these scenarios are built around:
--
--   * **The cap has to be honoured on read, and this is the only place that is
--     provable.** Scenario 5 builds the ordering no trigger can catch — a norm
--     put on a 30-day cadence while nothing depended on it, and a service
--     published afterwards — and then asks whether a check 8 days old is owed.
--     The stored column says no; `effective_probe_interval` says yes. If this
--     function ever reads `probe_interval` directly, that scenario is the one
--     that goes red.
--   * **Act-scoped rows are excluded, and the reason is starvation rather than
--     tidiness.** They can never be checked (`handler.ts` answers
--     `act_scope_unsupported` and writes nothing), so their `last_checked_at`
--     stays null, and null sorts first. Scenario 3 is what stops a handful of
--     them from permanently occupying the front of every batch.
--   * **Denials are separated by how they fail.** A missing `execute` grant
--     raises; a function that returned nothing would look identical to a
--     function nobody may call. Scenario 8 counts rows under `service_role`
--     before scenario 9 expects the exception under `authenticated`.
--   * **The counts are scoped to this script's own fixtures.** Every id carries
--     the `00000000-` prefix and the act ids are synthetic, because
--     `law_norms_watched_once` knows nothing about an id prefix and a fixture
--     citing a real article collides with `seed.sql`.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000e001a', 'due-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000e001b', 'due-lawyer@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000e001a';
update public.profiles set role = 'lawyer', full_name = 'The Lawyer'
where id = '00000000-0000-0000-0000-0000000e001b';

-- One service, published later than its dependency — which is scenario 5's
-- whole point and the reason the publication happens further down rather than
-- here.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000ea001', 'due-test-service', 'Due test service', 'family');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000ea001', '00000000-0000-0000-0000-0000000e001b', true);

insert into public.service_versions (id, service_id, version, status, generation_mode, review_mode) values
  ('00000000-0000-0000-0000-0000000eb001', '00000000-0000-0000-0000-0000000ea001', 1,
   'draft', 'template', 'auto');

-- The register. Five rows, each one a case:
--
--   c001  never checked, article-scoped        — due, and the most overdue
--   c002  checked a minute ago                 — not due
--   c003  act-scoped, never checked            — never due, however overdue
--   c004  checked 10 days ago, weekly cadence  — due
--   c005  30-day cadence, checked 8 days ago   — scenario 5's subject
insert into public.law_norms
  (id, source, act_id, act_title, article, source_url, canonical_url, last_checked_at) values
  ('00000000-0000-0000-0000-0000000ec001', 'zakon_rada', 'test-due-1', 'Тестовий кодекс Д1', '105',
   'https://zakon.rada.gov.ua/laws/show/2947-14#n800',
   'https://zakon.rada.gov.ua/laws/show/2947-14', null),
  ('00000000-0000-0000-0000-0000000ec002', 'zakon_rada', 'test-due-2', 'Тестовий кодекс Д2', '106',
   'https://zakon.rada.gov.ua/laws/show/2947-14#n801',
   'https://zakon.rada.gov.ua/laws/show/2947-14', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-0000000ec004', 'zakon_rada', 'test-due-4', 'Тестовий кодекс Д4', '108',
   'https://zakon.rada.gov.ua/laws/show/2947-14#n803',
   'https://zakon.rada.gov.ua/laws/show/2947-14', now() - interval '10 days');

insert into public.law_norms
  (id, source, act_id, act_title, scope, article, act_scope_reason, source_url, canonical_url,
   last_checked_at) values
  ('00000000-0000-0000-0000-0000000ec003', 'zakon_rada', 'test-due-3', 'Тестовий кодекс Д3',
   'act', null, 'The dependency really is on the whole act; noise expected.',
   'https://zakon.rada.gov.ua/laws/show/2947-14',
   'https://zakon.rada.gov.ua/laws/show/2947-14', null);

-- Scenario 5's norm. The slow cadence is set while nothing depends on it, which
-- is the only moment the guard permits it.
insert into public.law_norms
  (id, source, act_id, act_title, article, source_url, canonical_url,
   probe_interval, interval_reason, last_checked_at) values
  ('00000000-0000-0000-0000-0000000ec005', 'zakon_rada', 'test-due-5', 'Тестовий кодекс Д5', '109',
   'https://zakon.rada.gov.ua/laws/show/2947-14#n804',
   'https://zakon.rada.gov.ua/laws/show/2947-14',
   interval '30 days', 'A dormant transitional provision, watched loosely.',
   now() - interval '8 days');

do $$
declare
  n integer;
  v_first uuid;
begin
  set local role postgres;

  ------------------------------- 1. a norm nobody has ever checked is owed one
  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec001';
  raise notice '% 1. a never-checked article-scoped norm is in the batch (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------ 2. and one checked a minute ago is not
  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec002';
  raise notice '% 2. a norm checked inside its cadence is left alone (%)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ---------------------------------------- 3. the act-scoped row is never in it
  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec003';
  raise notice '% 3. an act-scoped norm is excluded — nothing can check it, and null sorts first (%)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------- 3b. the other half: identical row, one article field, and it is in it
  -- Without this, a function returning nothing at all would pass scenario 3.
  update public.law_norms set scope = 'article', article = '107', act_scope_reason = null
  where id = '00000000-0000-0000-0000-0000000ec003';

  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec003';
  raise notice '% 3b. the same row with an article is in the batch, so scenario 3 excluded the scope and not the row (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  update public.law_norms set scope = 'act', article = null,
    act_scope_reason = 'The dependency really is on the whole act; noise expected.'
  where id = '00000000-0000-0000-0000-0000000ec003';

  -------------------------- 4. a check older than the cadence is owed another
  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec004';
  raise notice '% 4. a norm last checked ten days ago on a weekly cadence is due (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  --------------------- 5. the stored cadence says no and the honoured one says
  -- yes. First the state the guard permits: no dependency, 30-day interval, and
  -- a check 8 days old is genuinely not due.
  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec005';
  raise notice '% 5a. with nothing depending on it, a 30-day cadence is honoured as written (%)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  -- Now the ordering no trigger on these tables can see: the dependency is
  -- added and the service is published, neither of which touches
  -- `law_norms.probe_interval`.
  insert into public.service_law_refs (id, service_id, norm_id, relied_on) values
    ('00000000-0000-0000-0000-0000000ed001', '00000000-0000-0000-0000-0000000ea001',
     '00000000-0000-0000-0000-0000000ec005', 'the transitional provision');

  update public.service_versions set status = 'published'
  where id = '00000000-0000-0000-0000-0000000eb001';

  select count(*) into n from public.law_norms_due_for_probe (50)
  where id = '00000000-0000-0000-0000-0000000ec005';
  raise notice '% 5b. once a service on sale depends on it, the operating maximum makes the same row due (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  -- And the stored column is untouched: the lawyer's choice is kept, the
  -- platform simply does not honour more than it promised itself.
  select count(*) into n from public.law_norms
  where id = '00000000-0000-0000-0000-0000000ec005' and probe_interval = interval '30 days';
  raise notice '% 5c. the cap is applied on read and the stored cadence still says what the lawyer asked for (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------------------- 6. most overdue first, nulls first
  select id into v_first from public.law_norms_due_for_probe (50)
  where id::text like '00000000-0000-0000-0000-0000000ec%' limit 1;
  raise notice '% 6. the never-checked norm is at the head of the batch (%)',
    case when v_first = '00000000-0000-0000-0000-0000000ec001' then 'PASS' else 'FAIL' end,
    coalesce(v_first::text, 'nothing');

  ------------------------------------------------------ 7. the limit is a limit
  select count(*) into n from public.law_norms_due_for_probe (2);
  raise notice '% 7. a batch of two returns two (%)',
    case when n = 2 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Who may ask ---------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role service_role;

  ------------------------------------------- 8. the sweeper can read its batch
  select count(*) into n from public.law_norms_due_for_probe (50);
  raise notice '% 8. service_role reads the batch (%)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000e001a","app_metadata":{"role":"admin"}}', true);

  ------------------- 9. and nobody else does, an admin included. A queue cursor
  -- is not a console surface; "what is stale" is ADM-49 and a different question.
  begin
    select count(*) into n from public.law_norms_due_for_probe (50);
    raise notice 'FAIL 9. an authenticated admin executed the scheduler''s batch query (%)', n;
  exception when insufficient_privilege then
    raise notice 'PASS 9. the batch is the sweeper''s alone — authenticated is refused';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
