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
-- Safe to run more than once, and safe on a project the CLI has never touched:
-- every statement is idempotent, and the ledger is created before anything
-- reads it. An earlier version of this script queried the table first and died
-- on a project where it did not exist yet — the SQL editor runs the whole
-- script as one batch, so the first failing statement takes the rest with it.

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
);

-- What the cloud believed before this ran. Empty is the normal answer.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- Every migration this repository has shipped. `statements` is left null on
-- purpose: the CLI writes it as a convenience when it applies a file itself,
-- and nothing reads it back. Version and name are what `db push` compares.
--
-- This list has to grow with every migration, and it will not do so by itself.
-- The only thing that makes it honest is the check at the bottom: a version
-- recorded here that was never applied is worse than an unrecorded one.
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260730120000', 'auth_profiles'),
  ('20260801120000', 'explicit_client_grants'),
  ('20260811120000', 'catalogue_services'),
  ('20260811130000', 'questionnaire_fields'),
  ('20260811140000', 'service_version_lifecycle_guards'),
  ('20260811150000', 'audit_event_log'),
  ('20260811160000', 'service_assignments'),
  ('20260812120000', 'practice_areas')
on conflict (version) do nothing;

-- Confirm. One row per file in supabase/migrations/, and no more.
-- A version recorded here that was never actually applied is worse than an
-- unrecorded one: `db push` will skip it, and the schema will silently lack
-- whatever it contained.
select version, name
from supabase_migrations.schema_migrations
order by version;
