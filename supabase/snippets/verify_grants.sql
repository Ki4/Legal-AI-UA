-- Verification scenarios for 20260813120000_explicit_sequence_grants.sql,
-- plus the coverage assertion that stands in for the cloud-only `ensure_rls`
-- event trigger (see docs/adr/0017-sequence-grants-and-rls-coverage.md).
--
--   docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres \
--     < supabase/snippets/verify_grants.sql
--
-- Everything runs inside one transaction and is rolled back, DDL included.
--
-- Note what these scenarios are worth and what they are not. Four of them prove
-- a privilege is gone, which is the easy half. Scenario 5 proves the revoke did
-- not break the thing the privilege looked like it was for — the half that
-- turns "we removed a grant" into "we removed a grant nobody needed".
--
-- One trap, found the hard way while writing this file. **Sequence operations
-- are not transactional.** `setval` is not undone by the `rollback` at the
-- bottom, and neither is `nextval`. A scenario that attempts the destructive
-- form of the forbidden call — `setval(seq, 1)` — is safe only for as long as
-- it keeps being denied: the day the revoke regresses, the script would prove
-- the regression by permanently corrupting the sandbox it runs against, and
-- every later script would fail on a primary key collision it did not cause.
-- So scenarios 1-3 attempt the call in a form that is a no-op if it succeeds:
-- the sequence's own current value, read back first as the owner. The privilege
-- is still exercised for real; only the blast radius is removed.
--
-- That is also the sharpest evidence for the migration this file verifies. The
-- damage a stray `setval` does is not something a transaction can take back.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'grants-admin@test.local');
update public.profiles set role = 'admin', full_name = 'Grants Admin'
where id = '00000000-0000-0000-0000-0000000000f1';

-- The privilege is gone ------------------------------------------------------

do $$
declare
  keep bigint;
  called boolean;
begin
  -- Read the sequence's own position first, as its owner, so the attempt below
  -- is the same privilege check with none of the consequences.
  set local role postgres;
  select last_value, is_called into keep, called from public.audit_events_id_seq;

  set local role anon;

  ------------------------------------ 1. anon cannot wind back the audit log
  begin
    perform setval('public.audit_events_id_seq', keep, called);
    raise notice 'FAIL 1. anon can move the audit log sequence';
  exception when insufficient_privilege then
    raise notice 'PASS 1. anon cannot touch the audit log sequence';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
declare
  keep bigint;
  called boolean;
begin
  set local role postgres;
  select last_value, is_called into keep, called from public.audit_events_id_seq;

  set local role authenticated;

  --------------------------------- 2. nor can a signed-in user of any role
  begin
    perform setval('public.audit_events_id_seq', keep, called);
    raise notice 'FAIL 2. an authenticated user can move the audit log sequence';
  exception when insufficient_privilege then
    raise notice 'PASS 2. an authenticated user cannot either';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
declare
  keep bigint;
  called boolean;
begin
  set local role postgres;
  select last_value, is_called into keep, called from public.audit_events_id_seq;

  set local role service_role;

  -------------------------------------------- 3. nor the backend identity
  -- Included where ADR-0007 left `service_role` alone, so that the sandbox and
  -- the cloud hold the same three revokes rather than two and a half. When the
  -- gateway needs something here it is granted in that migration, visibly.
  begin
    perform setval('public.audit_events_id_seq', keep, called);
    raise notice 'FAIL 3. service_role can move the audit log sequence';
  exception when insufficient_privilege then
    raise notice 'PASS 3. service_role holds nothing here it was not given';
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The half that governs sequences nobody has created yet ---------------------

do $$
declare
  holders text;
begin
  -- As the owner: this block is about what the schema hands out, not about
  -- anybody's rights.
  set local role postgres;

  create sequence public.verify_grants_probe_seq;

  ---------------------- 4. a sequence created today inherits nothing either
  select string_agg(role_name, ', ' order by role_name) into holders
  from unnest(array['anon', 'authenticated', 'service_role']) as role_name
  where has_sequence_privilege(role_name, 'public.verify_grants_probe_seq', 'UPDATE')
     or has_sequence_privilege(role_name, 'public.verify_grants_probe_seq', 'USAGE')
     or has_sequence_privilege(role_name, 'public.verify_grants_probe_seq', 'SELECT');

  raise notice '% 4. a new sequence reaches no client role (%)',
    case when holders is null then 'PASS' else 'FAIL' end,
    coalesce(holders, 'none');

  -- A one-time revoke would pass scenarios 1-3 and fail this one. That is the
  -- scenario worth having: the default privileges are what protect the table
  -- somebody adds in three months without reading this file.

  drop sequence public.verify_grants_probe_seq;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- And the log still works ----------------------------------------------------

do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000f1","app_metadata":{"role":"admin"}}';

  --------------------- 5. an audited write still records after the revoke
  -- The claim being checked: an identity column advances its own sequence
  -- under the table owner's rights, so revoking every client privilege on
  -- that sequence costs the audit log nothing. If that were wrong, this
  -- insert would fail rather than quietly record nothing — which is the
  -- failure direction worth having.
  insert into public.services (id, slug, title, practice_area)
  values ('00000000-0000-0000-0000-0000000000f9', 'grants-probe', 'Grants probe', 'family');

  set local role postgres;
  select count(*) into n from public.audit_events
  where entity_table = 'services'
    and entity_id = '00000000-0000-0000-0000-0000000000f9'
    and action = 'insert';

  raise notice '% 5. the audit log still records after the revoke (% row)',
    case when n = 1 then 'PASS' else 'FAIL' end, n;

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Coverage: the loud half of what the cloud does silently ---------------------

do $$
declare
  bare text;
begin
  set local role postgres;

  ------------------------------- 6. every table in public has RLS enabled
  -- The cloud carries an `ensure_rls` event trigger that switches RLS on by
  -- itself for any new table. ADR-0017 declines to copy it here: a table that
  -- forgot `enable row level security` is a mistake to surface, not to patch
  -- behind the author's back. This is the surfacing. It runs in CI on every
  -- change under supabase/, so the answer arrives in review rather than in
  -- production.
  select string_agg(c.relname, ', ' order by c.relname) into bare
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and not c.relrowsecurity;

  raise notice '% 6. every table in public has row security enabled (%)',
    case when bare is null then 'PASS' else 'FAIL' end,
    coalesce(bare, 'none without');

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- What `anon` may touch, swept rather than sampled -----------------------------
--
-- ADR-0007 turned off "automatically expose new tables" and stripped the default
-- privileges, so a new table is unreachable until its migration says otherwise.
-- That is a promise about every table, and until 2026-08-27 it was checked one
-- table at a time by whoever remembered — which is a promise about the tables
-- somebody thought of.
--
-- `has_table_privilege` is asked rather than `relacl` read, because a privilege
-- can arrive three ways: granted to `anon` directly, granted to `PUBLIC`, or
-- inherited through a role `anon` is a member of. Reading the ACL column sees
-- only the first, and would report a clean sweep while `grant select on all
-- tables to public` sat one migration away.
do $$
declare
  reachable text;
begin
  set local role postgres;

  ------------------------------------ 7. anon holds no privilege on any table
  select string_agg(format('%s (%s)', c.relname, p.privilege), ', ' order by c.relname, p.privilege)
    into reachable
  from pg_class c
  cross join lateral (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as p (privilege)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, p.privilege);

  raise notice '% 7. anon holds no privilege on any table in public (%)',
    case when reachable is null then 'PASS' else 'FAIL' end,
    coalesce(reachable, 'none reachable');

  -------------------------------------- 7b. nor on any sequence behind them
  -- A sequence is the half that gets forgotten: `grant insert` without
  -- `usage` on the sequence fails at runtime, so the fix is remembered — the
  -- reverse, a sequence left reachable, fails nothing and is noticed by nobody.
  select string_agg(format('%s (%s)', c.relname, p.privilege), ', ' order by c.relname, p.privilege)
    into reachable
  from pg_class c
  cross join lateral (values ('SELECT'), ('UPDATE'), ('USAGE')) as p (privilege)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'S'
    and has_sequence_privilege('anon', c.oid, p.privilege);

  raise notice '% 7b. anon holds no privilege on any sequence in public (%)',
    case when reachable is null then 'PASS' else 'FAIL' end,
    coalesce(reachable, 'none reachable');

  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
