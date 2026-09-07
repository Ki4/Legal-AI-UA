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

### Two things the first boot of the day will do to you

**A cold `start` can time out and roll the whole stack back.** If Docker Desktop has only just
come up, `storage-api` and `studio` are slow enough that the health check gives up, and the CLI
tears down every container and reports `LegacyHealthCheckTimeoutError` — which reads as "these
services are broken" when they were only late. Start it again; they come up healthy. To keep the
containers and read their logs instead of guessing, use `pnpm exec supabase start
--ignore-health-check`, which leaves an unhealthy service running rather than rolling back.

**`vector` restarts forever on Windows, and that is expected here.** The CLI points it at
`DOCKER_HOST=http://host.docker.internal:2375`, and Docker Desktop ships with "Expose daemon on
tcp://localhost:2375 without TLS" switched off, so it cannot list containers and exits. It feeds
logflare, which is the Logs tab in Studio; migrations, `verify:sql`, tests and the gates do not
touch it. The fix is that Docker Desktop setting, which opens the daemon over TCP with no TLS —
a real widening of what the machine exposes, so it is a deliberate choice, not a default.

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

Linking needs an access token and the database password. Until that happens, `snippets/repair_migration_ledger.sql`
does the same thing from the SQL editor — run it once against the cloud project, and keep its list
in step with the filenames in `migrations/`. A version recorded there that was never applied is
worse than an unrecorded one: `db push` will skip it, and the schema silently lacks whatever it
contained.

## Seed

`seed.sql` runs after migrations on every `db reset`. Invented data only — never real client
names, emails, or case details.

## Edge functions

`supabase/functions/law-article` is the article fetcher (ADR-0020, ADM-42). It reads
zakon.rada.gov.ua, fingerprints one article and — for a norm that exists — records the revision.

Serve it against the local stack:

```bash
pnpm functions:serve
```

**Not `supabase functions serve` directly**, and the difference is the one thing worth knowing here.
The edge runtime mounts `supabase/functions` and nothing above it, so the import map cannot point
into `packages/`; `pnpm functions:serve` first copies the shared package's runtime source into a
git-ignored `_shared/` where the container can see it, then serves (ADR-0025). The bare CLI command
skips the copy and answers `worker boot error: Module not found`. `pnpm functions:deploy` does the
same for the cloud.

It needs `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Locally the CLI
supplies all three; in the cloud project the first two are set for you and the service-role key is
added with `supabase secrets set`. The function refuses to start without them rather than running
with a client that can read nothing — a fetcher that silently records no revisions is the exact
failure §9.15 is written against.

The console calls it through `supabase.functions.invoke`, so the caller's JWT travels with the
request and the function asks the auth server whose it is. Only `admin` and `lawyer` are served.

**Checking the parser against the live site** is a separate, deliberate command, off in CI:

```bash
LAW_LIVE=1 pnpm exec vitest run supabase/functions/law-article/live.test.ts
```

If that fails while the rest of the suite passes, the saved fixtures have gone stale against the
publisher's markup — refresh them per `packages/law-refs/fixtures/README.md` and read the diff
before touching the parser.
