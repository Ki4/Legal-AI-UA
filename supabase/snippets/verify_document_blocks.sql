-- Verification scenarios for 20260828120000_document_blocks.sql.
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_document_blocks.sql
--
-- Everything runs inside one transaction and is rolled back.
--
-- Three things the scenarios are built around:
--
--   * **The freeze is asserted against the role that bypasses RLS.** ADR-0009's
--     promise is that editing a published version does not exist as an
--     operation, and the actor that could most easily defeat it is whatever
--     holds `service_role` — which no policy applies to. So the freeze arm runs
--     as `postgres` and expects an exception, while the assignment arm runs as
--     `authenticated` and counts rows. A rule tested only through a policy is a
--     rule the gateway is not subject to.
--   * **`version_is_frozen` must raise for a version that is not there.** It is
--     the one function here whose *silent* answer would be wrong: a lookup that
--     returned null for an invisible row would report "not frozen" and wave the
--     write through. Scenario 5 asserts the raise, because a freeze that fails
--     open is worse than no freeze — it reads as protection.
--   * **Denials are separated by how they fail.** A trigger raises; a policy
--     `using` clause writes nothing and says nothing. Asserting the second with
--     an exception handler would pass while the rule did nothing at all, so
--     those scenarios count rows.
--
-- Fixtures all carry the `00000000-` prefix and every count is scoped to them,
-- because a script that assumes an empty baseline fails on the seed rather than
-- on the schema.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000b001a', 'db-admin@test.local', '{"role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-0000000b001b', 'db-assigned@test.local', '{"role":"lawyer"}'::jsonb),
  ('00000000-0000-0000-0000-0000000b001c', 'db-stranger@test.local', '{"role":"lawyer"}'::jsonb);

update public.profiles set role = 'admin', full_name = 'The Admin'
where id = '00000000-0000-0000-0000-0000000b001a';
update public.profiles set role = 'lawyer', full_name = 'The Assigned Lawyer'
where id = '00000000-0000-0000-0000-0000000b001b';
update public.profiles set role = 'lawyer', full_name = 'A Stranger'
where id = '00000000-0000-0000-0000-0000000b001c';

-- Two services, and only the first has an accountable lawyer. The second is
-- what the assignment scenarios turn on: the same lawyer, a service that is not
-- theirs.
insert into public.services (id, slug, title, practice_area) values
  ('00000000-0000-0000-0000-0000000ba001', 'db-divorce', 'Divorce petition', 'family'),
  ('00000000-0000-0000-0000-0000000ba002', 'db-alimony', 'Alimony claim', 'family');

insert into public.service_assignments (service_id, lawyer_id, is_primary) values
  ('00000000-0000-0000-0000-0000000ba001', '00000000-0000-0000-0000-0000000b001b', true);

-- A draft to author in, a published version to fail against, a draft on the
-- service the lawyer does not answer for, and a fourth that is published
-- *during* the run — because scenario 7 needs a block that was authored
-- legitimately and only then fell under the freeze. It publishes over `bc002`,
-- which the publish trigger archives; an archived version keeps its
-- `published_at` and therefore stays frozen, which is what scenario 6 relies on
-- having already asserted by then.
insert into public.service_versions
  (id, service_id, version, status, generation_mode, review_mode)
values
  ('00000000-0000-0000-0000-0000000bc001', '00000000-0000-0000-0000-0000000ba001', 1,
   'draft', 'template', 'auto'),
  ('00000000-0000-0000-0000-0000000bc004', '00000000-0000-0000-0000-0000000ba001', 3,
   'draft', 'template', 'auto'),
  ('00000000-0000-0000-0000-0000000bc003', '00000000-0000-0000-0000-0000000ba002', 1,
   'draft', 'template', 'auto');

insert into public.service_versions
  (id, service_id, version, status, generation_mode, review_mode, published_at, published_by)
values
  ('00000000-0000-0000-0000-0000000bc002', '00000000-0000-0000-0000-0000000ba001', 2,
   'published', 'template', 'auto', now(), '00000000-0000-0000-0000-0000000b001a');

-- The shape of a block (§4.5, §5.1) ----------------------------------------------

do $$
begin
  set local role postgres;

  --------------------------------------------- 1. a key is machine-readable
  begin
    insert into public.document_blocks (service_version_id, key, title, body)
    values ('00000000-0000-0000-0000-0000000bc001', 'Intro Block', 'Intro', 'Text.');
    raise notice 'FAIL 1. a key with a space and a capital was accepted';
  exception when check_violation then
    raise notice 'PASS 1. a key the trace cannot carry as an id is refused';
  end;

  ------------------------------------------- 1b. and the shape that is right
  insert into public.document_blocks
    (id, service_version_id, key, title, body, position)
  values ('00000000-0000-0000-0000-0000000bd001', '00000000-0000-0000-0000-0000000bc001',
          'intro', 'Introduction', 'The parties agree as follows.', 0);
  raise notice 'PASS 1b. a lowercase key with underscores is a key';

  ------------------------------------- 2. one key, one version, one block
  begin
    insert into public.document_blocks (service_version_id, key, title, body)
    values ('00000000-0000-0000-0000-0000000bc001', 'intro', 'Again', 'Text.');
    raise notice 'FAIL 2. one version holds the same block key twice';
  exception when unique_violation then
    raise notice 'PASS 2. a key already used by this version is refused';
  end;

  --------------------------- 2b. and the same key on another version is fine
  insert into public.document_blocks
    (id, service_version_id, key, title, body, position)
  values ('00000000-0000-0000-0000-0000000bd002', '00000000-0000-0000-0000-0000000bc003',
          'intro', 'Introduction', 'Text.', 0);
  raise notice 'PASS 2b. two versions may each carry an intro block';

  ------------------------------------------ 3. a block with no text is not one
  begin
    insert into public.document_blocks (service_version_id, key, title, body)
    values ('00000000-0000-0000-0000-0000000bc001', 'empty', 'Empty', '   ');
    raise notice 'FAIL 3. a block shipped with nothing in it';
  exception when check_violation then
    raise notice 'PASS 3. whitespace is not a body';
  end;

  ------------------------- 3b. a blank condition is a mistake, absent is not
  begin
    insert into public.document_blocks
      (service_version_id, key, title, body, condition_expression)
    values ('00000000-0000-0000-0000-0000000bc001', 'blank_cond', 'Blank', 'Text.', '  ');
    raise notice 'FAIL 3b. a block was selected by a blank condition';
  exception when check_violation then
    raise notice 'PASS 3b. a present-but-blank condition is refused';
  end;

  insert into public.document_blocks
    (id, service_version_id, key, title, body, condition_expression, needs_attention)
  values ('00000000-0000-0000-0000-0000000bd003', '00000000-0000-0000-0000-0000000bc001',
          'children', 'Children', 'Where there are minor children...',
          'has_children == true', true);
  raise notice 'PASS 3c. a condition and a needs_attention flag are a block';

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- A key is an identity, not a heading (ADR-0009) ----------------------------------

do $$
begin
  set local role postgres;

  ------------------------------------ 4. a key cannot be renamed
  begin
    update public.document_blocks set key = 'renamed'
    where id = '00000000-0000-0000-0000-0000000bd001';
    raise notice 'FAIL 4. a block key was renamed under a trace that cites it';
  exception when raise_exception then
    raise notice 'PASS 4. renaming a key is refused — the title is what changes';
  end;

  ------------------------------------ 4b. and a block cannot move between versions
  begin
    update public.document_blocks
    set service_version_id = '00000000-0000-0000-0000-0000000bc003'
    where id = '00000000-0000-0000-0000-0000000bd001';
    raise notice 'FAIL 4b. a block moved to another version, key and all';
  exception when raise_exception then
    raise notice 'PASS 4b. a block cannot move between versions';
  end;

  ------------------------------------ 4c. the title is what the renaming urge gets
  update public.document_blocks set title = 'Preamble'
  where id = '00000000-0000-0000-0000-0000000bd001';
  raise notice 'PASS 4c. a title is editable while a draft is a draft';

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The freeze, against the role RLS does not apply to (§5.4, ADR-0009, ADR-0019) ---

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------------------ 5. a missing version does not read as unfrozen
  --
  -- The one silent answer that would be wrong. A lookup returning null here
  -- would report "not frozen" and let the write through, and nothing would say
  -- so.
  begin
    perform public.version_is_frozen ('00000000-0000-0000-0000-00000000dead');
    raise notice 'FAIL 5. a version that does not exist answered the freeze question';
  exception when raise_exception then
    raise notice 'PASS 5. version_is_frozen raises rather than answering for a missing row';
  end;

  ------------------------------------------- 6. no block enters a published version
  begin
    insert into public.document_blocks (service_version_id, key, title, body)
    values ('00000000-0000-0000-0000-0000000bc002', 'late', 'Added later', 'Text.');
    raise notice 'FAIL 6. a block was added to a published version';
  exception when raise_exception then
    raise notice 'PASS 6. a published version accepts no new block';
  end;

  --------------------------- 7. and a block already in one cannot be edited
  --
  -- Authored into a draft, which is then published: the block was legitimate
  -- when it was written and falls under the freeze afterwards. That is the real
  -- sequence, and it is the one an insert-into-a-published-version scenario
  -- cannot reach.
  insert into public.document_blocks
    (id, service_version_id, key, title, body)
  values ('00000000-0000-0000-0000-0000000bd004', '00000000-0000-0000-0000-0000000bc004',
          'closing', 'Closing', 'Signed at...');

  update public.service_versions
  set status = 'published', published_at = now(),
      published_by = '00000000-0000-0000-0000-0000000b001a'
  where id = '00000000-0000-0000-0000-0000000bc004';

  begin
    update public.document_blocks set body = 'Rewritten after publication.'
    where id = '00000000-0000-0000-0000-0000000bd004';
    raise notice 'FAIL 7. a published version''s block was rewritten';
  exception when raise_exception then
    raise notice 'PASS 7. a published version''s blocks are frozen';
  end;

  ----------------------------------------- 7b. deletion is an edit too
  begin
    delete from public.document_blocks
    where id = '00000000-0000-0000-0000-0000000bd004';
    raise notice 'FAIL 7b. a published version''s block was deleted';
  exception when raise_exception then
    raise notice 'PASS 7b. a published version''s block cannot be deleted either';
  end;

  select count(*) into n from public.document_blocks
  where service_version_id = '00000000-0000-0000-0000-0000000bc004';
  raise notice '% 7c. the published version still carries the block it was published with (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Who may write a template's blocks (§4.5, DoD §7) --------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;

  ------------------------------- 8. the lawyer answering for the service writes
  --
  -- Counted rather than caught: a denial through `using` writes nothing and
  -- raises nothing, so an exception handler would report success for a rule
  -- doing nothing at all. `bv003` is the draft on the *other* service, so this
  -- writes against `bb002` only through scenario 9.
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000b001b","app_metadata":{"role":"lawyer"}}';
  update public.document_blocks set title = 'Edited by the assigned lawyer'
  where id = '00000000-0000-0000-0000-0000000bd003';
  get diagnostics n = row_count;
  raise notice '% 8. the assigned lawyer edits a block of their service (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  ------------------------------- 9. and writes nothing on a service that is not theirs
  update public.document_blocks set title = 'Reached across'
  where id = '00000000-0000-0000-0000-0000000bd002';
  get diagnostics n = row_count;
  raise notice '% 9. the assigned lawyer does not edit the next service''s block (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ---------------------------------------- 10. a stranger writes nothing at all
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000b001c","app_metadata":{"role":"lawyer"}}';
  delete from public.document_blocks
  where id = '00000000-0000-0000-0000-0000000bd003';
  get diagnostics n = row_count;
  raise notice '% 10. a lawyer with no assignment deletes nothing (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  ------------------------------------- 11. but reads everything, because a template
  --                                       carries no client data (§4.5)
  select count(*) into n from public.document_blocks
  where service_version_id in ('00000000-0000-0000-0000-0000000bc001',
                               '00000000-0000-0000-0000-0000000bc003');
  raise notice '% 11. an unassigned lawyer reads the templates anyway (% rows)',
    case when n = 3 then 'PASS' else 'FAIL' end, n;

  ---------------------------------------------- 12. an admin writes anywhere
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000b001a","app_metadata":{"role":"admin"}}';
  update public.document_blocks set title = 'Edited by the admin'
  where id = '00000000-0000-0000-0000-0000000bd002';
  get diagnostics n = row_count;
  raise notice '% 12. an admin edits a block on any service (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The log, not a history of its own (ADR-0010, §6.1) ------------------------------

do $$
declare
  n integer;
begin
  set local role postgres;

  ------------------------- 13. every write landed in audit_events, under its service
  --
  -- The mapping is what makes the per-service history screen whole. A table
  -- reaching `audit_change` without one raises, so the failure this asserts is
  -- the quieter opposite: a mapping present but pointing at the wrong service.
  select count(*) into n from public.audit_events
  where entity_table = 'document_blocks'
    and service_id = '00000000-0000-0000-0000-0000000ba001';
  raise notice '% 13. block writes are logged under their service (% rows)',
    case when n > 0 then 'PASS' else 'FAIL' end, n;

  select count(*) into n from public.audit_events
  where entity_table = 'document_blocks' and service_id is null;
  raise notice '% 13b. no block event was logged without a service (% rows)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

rollback;
