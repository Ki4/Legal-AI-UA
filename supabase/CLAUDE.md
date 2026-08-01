# supabase — context

Read the root `CLAUDE.md` first; local setup is in `supabase/README.md`.

## Migrations are the only way schema changes

No manual changes in the Supabase dashboard that outlive a session. Every schema change — table,
column, function, policy, grant — is a migration file under `supabase/migrations/`. If it isn't
in a migration, it doesn't exist as far as the team is concerned.

## RLS on everything

Row Level Security is enabled on every table, no exceptions, from the migration that creates it.
A table with RLS enabled and no policies is the safe default while access rules are worked out —
never ship a table with RLS off.

## Explicit grants only

"Automatically expose new tables" is disabled project-wide, and
`20260801120000_explicit_client_grants.sql` strips the privileges the platform grants to `anon`
and `authenticated` by default (see `docs/adr/0007-explicit-grants-for-client-roles.md`). Every
table needs its `grant` written out in the migration; nothing is reachable by default. See
`20260730120000_auth_profiles.sql` for the pattern: explicit `grant select ... to authenticated`,
paired with policies that further restrict rows.

Check the result against a running database, not against the migration text — bring up the local
sandbox and read the ACL:

```sql
select relacl from pg_class where relname = '<table>' and relnamespace = 'public'::regnamespace;
```

## Every policy needs a verification scenario

A PR that adds or changes a policy must describe, in the PR description, how it was verified —
which role/user was used, which rows were expected to be visible or writable, and the actual
result. "Looks correct" is not a scenario.

## The one hard review rule

Any migration touching access control (RLS policies, `auth.*`, JWT `app_metadata`, consents)
always requires a second reviewer before merge — no self-merge, ever, regardless of who wrote it.
Core owner preferred as reviewer. This is the one exception to the default review matrix in
`docs/CONTRIBUTING.md`. Separately, any migration is automatically Tier 2 (full spec + ADR, see
`docs/CONTRIBUTING.md`) regardless of how small the diff looks.
