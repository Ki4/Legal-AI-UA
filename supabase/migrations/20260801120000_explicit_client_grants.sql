-- Make "explicit grants only" true for the client roles.
--
-- Found while bringing up the local sandbox: `public.profiles` carried
--   anon=Dxtm  authenticated=rDxtm
-- where `r` is the SELECT our auth migration granted on purpose, and D/x/t/m
-- (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) came from the platform's default
-- privileges for the `public` schema — inherited, never asked for. RLS does not
-- constrain TRUNCATE: a role holding it empties the table regardless of policies.
--
-- Severity, stated honestly: not reachable through the Data API today, because
-- PostgREST exposes only SELECT/INSERT/UPDATE/DELETE and RPC — there is no path
-- for a browser client to issue TRUNCATE or DDL. This is defense in depth, and it
-- makes the codebase match what supabase/CLAUDE.md already promises: a client role
-- holds exactly the privileges a migration granted it, and nothing else.
--
-- `service_role` is deliberately untouched: it is the trusted backend identity.

revoke all on all tables in schema public from anon, authenticated;

-- Migrations run as `postgres`, so this governs every table we create from now on.
-- The platform also keeps a `supabase_admin` default ACL, which does not apply to
-- objects owned by `postgres` — i.e. not to anything in this repo.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- Re-grant, explicitly, the one privilege the console actually needs.
grant select on table public.profiles to authenticated;
