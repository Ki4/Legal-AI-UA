# Supabase

Migrations in `migrations/` are the only way the schema changes — for the cloud project and
for every local sandbox alike. Nobody edits a database by hand; the single exception is the
one-time first-admin bootstrap documented inside `20260730120000_auth_profiles.sql`.

## Local sandbox (Docker required)

Every developer runs their own full Supabase copy, built entirely from this directory:

```bash
pnpm exec supabase start   # boots local Postgres + Auth + API (first run downloads images)
pnpm exec supabase db reset  # wipe + replay all migrations + seed.sql
pnpm exec supabase status  # prints local URL and keys
pnpm exec supabase stop    # shuts the stack down
```

The CLI is a repo devDependency — `pnpm install` gives everyone the same version.

Point the console at the sandbox by putting the values from `supabase status` into
`apps/console/.env` (`VITE_SUPABASE_URL=http://127.0.0.1:54321` + the printed anon key), then
restart the dev server. Swap back to the cloud values to work against the shared project.
Local Studio UI: http://127.0.0.1:54323.

Break the sandbox freely — `db reset` rebuilds it in seconds. The cloud database is treated
as production: it only ever changes by applying merged migration files.

## Workflow for a schema change

1. Branch, write a new file in `migrations/` (timestamp prefix, snake_case name).
2. Test it locally: `pnpm exec supabase db reset` must run clean.
3. PR. Access-control migrations (RLS, `auth.*`, consents) always need a second reviewer —
   see `supabase/CLAUDE.md`. Every policy ships with a verification scenario.
4. After merge, the migration is applied to the cloud project (today: manually via the SQL
   editor by the product owner; next: `supabase db push` from CI).

## Seed

`seed.sql` runs after migrations on every `db reset`. Invented data only — never real client
names, emails, or case details.
