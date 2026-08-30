-- Verification scenarios for 20260830120000_law_norm_revisions.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_law_revisions.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Four things these scenarios are built around:
--
--   * **The guard's two halves are one character apart in meaning and must be
--     tested apart.** "The same text twice in a row is refused" and "the same
--     text after different text is accepted" are the whole of the rule; a
--     script asserting only the first would pass against a trigger that
--     refused every insert, and one asserting only the second would pass
--     against no trigger at all. Scenarios 3 and 4 are that pair, and 4 is the
--     one the obvious `unique (norm_id, fingerprint)` would have failed.
--   * **`law_norms.fingerprint` is now derived, so the test is that it moved
--     without anybody moving it.** Scenario 5 inserts a revision and reads the
--     register, which is the only claim that makes the adopt trigger worth its
--     lines.
--   * **What the trigger must NOT touch is asserted too** (scenario 6). `state`
--     and the two timestamps are the fetcher's, and §9.10 exists because
--     "checked and unchanged" and "never successfully checked" must not be
--     rendered alike. A trigger quietly setting `last_verified_at` would make
--     them alike, and nothing else in the schema would notice.
--   * **Denials are separated by how they fail.** A missing grant raises; a
--     policy `using` clause writes nothing and says nothing. The write side of
--     this table has no grant at all — deliberately, because the only author is
--     `service_role` — so scenarios 8 and 9 expect an exception, while the read
--     side is counted rather than caught.
--
-- Fixtures use the `00000000-` prefix so counts are scoped to this script and
-- not to the seed, and the act ids are synthetic for the harder reason
-- `verify_law_refs.sql` records: `law_norms_watched_once` knows nothing about an
-- id prefix, so a fixture citing a real article of a real code collides with
-- `seed.sql` and kills the script before its first scenario.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000e001a', 'rev-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000e001b', 'rev-lawyer@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000e001a';
update public.profiles set role = 'lawyer', full_name = 'A Lawyer'
where id = '00000000-0000-0000-0000-0000000e001b';

-- One norm, never fetched. Every scenario below writes revisions against it.
insert into public.law_norms (id, source, act_id, act_title, article, source_url, canonical_url)
values ('00000000-0000-0000-0000-0000000e0001', 'zakon_rada', 'test-0009',
        'Тестовий кодекс Р', '42',
        'https://zakon.rada.gov.ua/laws/show/test-0009',
        'https://zakon.rada.gov.ua/laws/show/test-0009');

-- The shape of a fingerprint -----------------------------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  --------------------------------- 1. a fingerprint says which algorithm made it
  begin
    insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
    values ('00000000-0000-0000-0000-0000000e0001', 'deadbeef', 1, 'Текст статті сорок два.');
    raise notice 'FAIL 1. a bare hash was stored with nothing saying what produced it';
  exception when check_violation then
    raise notice 'PASS 1. a fingerprint without its algorithm prefix is refused';
  end;

  ------------------------------------ 2. a revision with no text is not a revision
  begin
    insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
    values ('00000000-0000-0000-0000-0000000e0001',
            'sha256:1111111111111111111111111111111111111111111111111111111111111111', 1, '   ');
    raise notice 'FAIL 2. an empty extraction was stored as though it were an article (§9.15)';
  exception when check_violation then
    raise notice 'PASS 2. a revision whose text is blank is refused';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The guard: recorded on change, not on check (§9.7) ------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  insert into public.law_norm_revisions (id, norm_id, fingerprint, normalizer_version, content)
  values ('00000000-0000-0000-0000-0000000e1001', '00000000-0000-0000-0000-0000000e0001',
          'sha256:aaaa111111111111111111111111111111111111111111111111111111111111', 1,
          'Перша редакція статті сорок два.');

  ----------------------------- 3. the same text again is a check, not a revision
  begin
    insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
    values ('00000000-0000-0000-0000-0000000e0001',
            'sha256:aaaa111111111111111111111111111111111111111111111111111111111111', 1,
            'Перша редакція статті сорок два.');
    raise notice 'FAIL 3. an unchanged article was recorded as a new revision';
  exception when raise_exception then
    raise notice 'PASS 3. a revision identical to the current one is refused';
  end;

  ------------------------------------------------ 4. and a revert IS a revision
  --
  -- The case that rules out `unique (norm_id, fingerprint)`, which is the
  -- constraint anyone would reach for first. An amendment can be repealed and
  -- the article returns to wording it already had; "it changed back on the 12th"
  -- is a fact this table exists to still know in six months.
  insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
  values ('00000000-0000-0000-0000-0000000e0001',
          'sha256:bbbb222222222222222222222222222222222222222222222222222222222222', 1,
          'Друга редакція статті сорок два.');

  insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
  values ('00000000-0000-0000-0000-0000000e0001',
          'sha256:aaaa111111111111111111111111111111111111111111111111111111111111', 1,
          'Перша редакція статті сорок два.');

  select count(*) into n from public.law_norm_revisions
  where norm_id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 4. an article reverting to earlier wording is recorded (% revisions)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The register cannot disagree with the log ---------------------------------------

do $$
declare
  v_fingerprint text;
  v_state public.law_norm_state;
  v_checked timestamptz;
  v_verified timestamptz;
begin
  set local role postgres;

  ------------------------- 5. the register adopted the newest revision by itself
  select fingerprint into v_fingerprint from public.law_norms
  where id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 5. law_norms.fingerprint follows the revision log without being written (%)',
    case
      when v_fingerprint
        = 'sha256:aaaa111111111111111111111111111111111111111111111111111111111111'
      then 'PASS' else 'FAIL'
    end,
    coalesce(v_fingerprint, 'null');

  ------------------ 6. and left the fetcher's three columns exactly where they were
  --
  -- §9.10: a broken fetcher must not be able to look like a quiet week. If
  -- inserting a revision moved `last_verified_at`, then storing text would
  -- silently assert that a check succeeded — which is the one claim this table
  -- has no standing to make.
  select state, last_checked_at, last_verified_at into v_state, v_checked, v_verified
  from public.law_norms where id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 6. state and both timestamps are still the fetcher''s (state %, checked %, verified %)',
    case
      when v_state = 'unverified' and v_checked is null and v_verified is null
      then 'PASS' else 'FAIL'
    end,
    v_state, coalesce(v_checked::text, 'null'), coalesce(v_verified::text, 'null');

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Access ---------------------------------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000e001b","app_metadata":{"role":"lawyer"}}', true);

  ------------------------------------------- 7. a lawyer reads the whole history
  --
  -- Deliberately not scoped to their assignments, and asserted on purpose so
  -- that nobody "tightens" it later without meeting this line. §4.11 shows a
  -- norm once, with every dependent service against it; the diff behind a
  -- signal is firm knowledge on the same footing.
  select count(*) into n from public.law_norm_revisions
  where norm_id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 7. a lawyer reads a norm''s revisions without being assigned to anything (%)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  --------------------------------------- 8. and cannot write one, loudly
  --
  -- No insert grant at all, so this raises rather than silently writing nothing.
  -- The loud form is available here precisely because no legitimate writer lives
  -- inside `authenticated` — the fetcher is `service_role` and bypasses RLS.
  begin
    insert into public.law_norm_revisions (norm_id, fingerprint, normalizer_version, content)
    values ('00000000-0000-0000-0000-0000000e0001',
            'sha256:cccc333333333333333333333333333333333333333333333333333333333333', 1,
            'Редакція, написана людиною.');
    raise notice 'FAIL 8. a lawyer wrote a revision by hand';
  exception when insufficient_privilege then
    raise notice 'PASS 8. a lawyer has no grant to write a revision, and the refusal is loud';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000e001a","app_metadata":{"role":"admin"}}', true);

  --------------------------------------- 9. an admin cannot delete history either
  --
  -- ADM-24's impact index has to answer "which issued documents rested on this,
  -- and on what wording" long after the last service stopped citing the norm.
  begin
    delete from public.law_norm_revisions
    where norm_id = '00000000-0000-0000-0000-0000000e0001';
    raise notice 'FAIL 9. an admin deleted the record of what an article used to say';
  exception when insufficient_privilege then
    raise notice 'PASS 9. nobody deletes a revision through the API, admin included';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e001b"}', true);

  --------------------------------- 10. and a session with no role reads nothing
  --
  -- Counted rather than caught: the select grant exists, so the policy filters
  -- rows away in silence. Asserting this with an exception handler would pass
  -- while the policy did nothing at all.
  select count(*) into n from public.law_norm_revisions;
  raise notice '% 10. a session carrying no role reads no revisions (%)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Out of order, and our own normalizer -----------------------------------------

do $$
declare
  v_fingerprint text;
  n integer;
begin
  set local role postgres;

  --------------- 11. a revision observed earlier does not become the current text
  --
  -- The adopt trigger updated unconditionally in its first version, so a
  -- backfill, a delayed retry, or a slow fetcher finishing after a fast one
  -- would have made the register claim the article currently says something it
  -- stopped saying. That reads as a perfectly healthy register while the norm
  -- sits permanently drifted against text nobody publishes any more.
  insert into public.law_norm_revisions
    (norm_id, fingerprint, normalizer_version, content, observed_at)
  values ('00000000-0000-0000-0000-0000000e0001',
          'sha256:dddd444444444444444444444444444444444444444444444444444444444444', 1,
          'Дуже стара редакція статті сорок два.', now() - interval '10 years');

  select fingerprint into v_fingerprint from public.law_norms
  where id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 11. a revision observed ten years ago did not become the register''s current text (%)',
    case
      when v_fingerprint
        = 'sha256:aaaa111111111111111111111111111111111111111111111111111111111111'
      then 'PASS' else 'FAIL'
    end,
    coalesce(v_fingerprint, 'null');

  -------------------- 12. and it is still recorded, because history is the point
  select count(*) into n from public.law_norm_revisions
  where norm_id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 12. the out-of-order revision was stored rather than dropped (%)',
    case when n = 4 then 'PASS' else 'FAIL' end, n;

  ------------------- 13. a renormalization under the same rules is not one at all
  begin
    insert into public.law_norm_revisions
      (norm_id, fingerprint, normalizer_version, content, origin)
    values ('00000000-0000-0000-0000-0000000e0001',
            'sha256:eeee555555555555555555555555555555555555555555555555555555555555', 1,
            'Текст, нібито перерахований.', 'renormalized');
    raise notice 'FAIL 13. a revision claimed a recomputation with nothing recomputed';
  exception when raise_exception then
    raise notice 'PASS 13. renormalized under an unchanged normalizer version is refused';
  end;

  ------------- 14. and under a new one it is recorded as ours, not the publisher's
  --
  -- The whole reason the column exists: without it this row is a fingerprint
  -- that differs from the stored one, which is every downstream reader's
  -- definition of a drift — and on the morning a normalizer is bumped there are
  -- two hundred of them, each with a one-business-day triage clock (§9.16).
  insert into public.law_norm_revisions
    (norm_id, fingerprint, normalizer_version, content, origin)
  values ('00000000-0000-0000-0000-0000000e0001',
          'sha256:ffff666666666666666666666666666666666666666666666666666666666666', 2,
          'Той самий текст, зведений за новими правилами.', 'renormalized');

  select count(*) into n from public.law_norm_revisions
  where norm_id = '00000000-0000-0000-0000-0000000e0001' and origin = 'renormalized';
  raise notice '% 14. a recomputation under new rules is recorded and labelled ours (%)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  --------------------------------- 15. and a revision is `observed` by default
  --
  -- The default is the half that matters operationally: every row the fetcher
  -- writes without thinking about it is the publisher's doing, which is the
  -- common case and the one that must not need remembering.
  select count(*) into n from public.law_norm_revisions
  where norm_id = '00000000-0000-0000-0000-0000000e0001' and origin = 'observed';
  raise notice '% 15. revisions written without naming an origin are the publisher''s (%)',
    case when n = 4 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The register's machine-written columns ------------------------------------------
--
-- The race the guard's row lock closes is deliberately **not** scenarioed here,
-- and saying so is better than a scenario that pretends. Two sessions committing
-- concurrently cannot be built inside one transaction that ends in `rollback`,
-- which is the shape every script in this directory has. What is asserted below
-- is the half that a single session can prove; the lock is argued in the
-- migration and would need a two-session harness this repository does not have.

do $$
declare
  v_verified timestamptz;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000e001a","app_metadata":{"role":"admin"}}', true);

  -------------------------- 16. nobody hand-writes "this was checked and matched"
  --
  -- §9.10 is the whole of this one. `freshness.ts` reads this column for the
  -- console's badge, so before the column grant an admin could `PATCH` a norm
  -- into looking freshly verified with no check having happened — a broken or
  -- entirely unbuilt fetcher rendering as a quiet week, by hand.
  begin
    update public.law_norms set last_verified_at = now()
    where id = '00000000-0000-0000-0000-0000000e0001';
    raise notice 'FAIL 16. a norm was marked verified by hand, with nothing checked (§9.10)';
  exception when insufficient_privilege then
    raise notice 'PASS 16. last_verified_at is not writable through the API';
  end;

  ------------------------------ 17. nor the fingerprint the revision log derives
  begin
    update public.law_norms
    set fingerprint = 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    where id = '00000000-0000-0000-0000-0000000e0001';
    raise notice 'FAIL 17. the register''s fingerprint was set by hand, behind the revision log';
  exception when insufficient_privilege then
    raise notice 'PASS 17. fingerprint is not writable through the API';
  end;

  --------------------- 18. and the columns a person owns are still theirs to edit
  --
  -- The other half of the rule. A revoke that took everything would pass 16 and
  -- 17 while breaking the cadence editor, and only this scenario tells the two
  -- apart.
  update public.law_norms
  set probe_interval = interval '3 days', interval_reason = 'amended twice this year'
  where id = '00000000-0000-0000-0000-0000000e0001';
  raise notice 'PASS 18. the cadence and its reason are still editable by a person';

  ------------------------------- 19. the guard did not silently swallow the write
  select last_verified_at into v_verified from public.law_norms
  where id = '00000000-0000-0000-0000-0000000e0001';
  raise notice '% 19. last_verified_at is still null after all of that (%)',
    case when v_verified is null then 'PASS' else 'FAIL' end,
    coalesce(v_verified::text, 'null');

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
