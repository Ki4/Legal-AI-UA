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
3. Write the verification script at `snippets/verify_<area>.sql` and run it against the sandbox.
   Every policy ships with scenarios, denials included — see `supabase/CLAUDE.md`.
4. `pnpm db:types` — regenerate `packages/db/src/database.types.ts` from the sandbox. Row types
   are derived from it, so a migration that changes a column and does not regenerate leaves
   TypeScript describing a table that no longer exists.
5. PR. Access-control migrations (RLS, `auth.*`, consents) need a second reviewer when there is
   one; while the team is a single developer that rule is suspended against the substitutes in
   `docs/CONTRIBUTING.md`.
6. After merge, the migration is applied to the cloud project (today: manually via the SQL
   editor by the product owner; next: `supabase db push` from CI).

**Before the first `db push`, repair the ledger.** Migrations applied by hand are invisible to the
CLI, which keeps its own record in `supabase_migrations.schema_migrations`. A `db push` would try
to replay them and fail on objects that already exist. Once the project is linked:

```bash
pnpm exec supabase migration repair --status applied <version> [<version> ...]
```

Check what the cloud already believes with
`select version from supabase_migrations.schema_migrations order by version;`.

## Seed

`seed.sql` runs after migrations on every `db reset`. Invented data only — never real client
names, emails, or case details.
