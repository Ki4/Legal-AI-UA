-- Tell the cloud project which migrations it already has.
--
-- Every migration so far was applied by hand through the SQL editor, which the
-- CLI cannot see: it keeps its own record in `supabase_migrations`. The first
-- `supabase db push` would therefore try to replay all of them and fail on the
-- first `create type` that already exists.
--
-- `supabase migration repair --status applied <version>` does exactly what the
-- INSERT below does, and is the right tool once the project is linked. Linking
-- needs an access token and the database password, so until that happens this
-- script is the same operation by hand. Run it in the SQL editor, once.
--
-- Safe to run more than once: the insert is idempotent.

-- 1. What does the cloud believe today? Run this first and read it.
--    An error saying the schema does not exist means the CLI has never touched
--    this project, and there is nothing to repair — the insert below will create
--    the ledger and fill it in one go.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 2. Record every migration this repository has shipped.
--    `statements` is left null on purpose: it is a convenience the CLI writes
--    when it applies a file itself, and nothing reads it back. Version and name
--    are what `db push` compares against.

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);

insert into supabase_migrations.schema_migrations (version, name) values
  ('20260730120000', 'auth_profiles'),
  ('20260801120000', 'explicit_client_grants'),
  ('20260811120000', 'catalogue_services'),
  ('20260811130000', 'questionnaire_fields'),
  ('20260811140000', 'service_version_lifecycle_guards'),
  ('20260811150000', 'audit_event_log'),
  ('20260811160000', 'service_assignments')
on conflict (version) do nothing;

-- 3. Confirm. Seven rows, and they must match the filenames in
--    supabase/migrations/ exactly — a version recorded here that was never
--    actually applied is worse than an unrecorded one, because `db push` will
--    skip it and the schema will silently lack whatever it contained.
select version, name
from supabase_migrations.schema_migrations
order by version;
