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

## On a client-bearing table, RLS is not where the rules go

RLS decides who may read a row. What a **write** may do — a lifecycle, a pin that cannot move, a
precondition for delivery — is a `before` trigger, and a `security definer` one. Two reasons, both
in `docs/adr/0019-client-table-rules-live-in-security-definer-triggers.md`: the gateway writes these
tables as `service_role`, which RLS does not apply to at all, and a guard running as its caller sees
only what the caller may see — which for `entitlements` is nothing, so it would refuse a correct
write citing somebody else's client.

The corollary is about refusals. Withholding the grant makes a denial loud, and that is available
only where the table has **no** authorised reader inside `authenticated` — `client_identities` has
none, `entitlements` has admins. Everywhere else the denial is a silent empty result, and the answer
is that no screen without the right reads the table: a `security definer` function hands it the
yes/no instead.

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

## Applying a migration by hand means repairing the ledger

`psql < migration.sql` puts the schema in place and tells the CLI nothing. The next `db push` then
believes the migration was never applied, which is how the cloud project spent a week with seven
migrations the CLI could not see.

Two consequences, both cheap and both easy to skip:

- `snippets/repair_migration_ledger.sql` lists every migration this repository has shipped. It does
  not grow by itself. **A new migration adds a line to it in the same PR.**
- Prefer `pnpm exec supabase db reset` locally over applying a file by hand. It rebuilds from the
  migrations and the seed, so the ledger is honest by construction — and it is the only thing that
  checks the migration applies to an _empty_ database, which is the case every fresh environment is
  and no incremental apply ever tests.

Since 2026-09-02 something asks rather than nobody: `pnpm check:cloud-ledger` compares
`supabase migration list --linked` against the files, on every push to `main`. It found the same
drift a second time on the day it was written.

**It compares the ledger, not the schema, and that difference is the whole trap.** A migration run
by hand through the dashboard's SQL editor leaves the objects in place and no ledger row, so the
checker reports it identically to one that was never applied anywhere. The two need opposite
responses, and guessing wrong is expensive in both directions: `db push` against a hand-applied
migration dies on the first `create type ... already exists`, and `migration repair` against one
that genuinely never ran records a lie that `db push` will then skip forever.

So ask the database what it actually holds before choosing. Docker is not needed for this — it runs
in the dashboard's SQL editor, which is also where a hand-applied migration was run in the first
place:

```sql
-- Replace the table list with the tables the disputed migrations create.
with t (name) as (values ('law_norm_revisions'), ('law_signals'))
select 'type' as kind, typname as name
  from pg_type join pg_namespace n on n.oid = typnamespace
 where n.nspname = 'public' and typtype = 'e'
union all
select 'index', indexname from pg_indexes
 where schemaname = 'public' and tablename in (select name from t)
union all
select 'policy', policyname from pg_policies
 where schemaname = 'public' and tablename in (select name from t)
union all
select 'rls', relname || ' = ' || relrowsecurity::text
  from pg_class join pg_namespace n on n.oid = relnamespace
 where n.nspname = 'public' and relname in (select name from t)
union all
select 'constraint', conname
  from pg_constraint join pg_class c on c.oid = conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in (select name from t)
union all
select 'ledger', version from supabase_migrations.schema_migrations
 order by 1, 2;
```

Read it against the migration file, not against memory — the enums, indexes, policies and named
check constraints are the parts a partial hand-run drops, and they are exactly the parts no ERD
screenshot shows. Then:

- **everything the file declares is there** — `supabase migration repair --status applied <version>`
  for each. The schema is right; only the record of it is missing.
- **some of it is there** — finish the missing objects by hand from the same file, verify with the
  query again, and only then repair. A repair over a half-applied migration is the lie above.
- **none of it is there** — `supabase db push`, which is the ordinary case this section is not about.

## Restating `audit_change` is how a mapping gets lost

`audit_change` raises for a table it has no mapping for, which is what makes the mapping impossible
to forget. Adding a table means restating the whole function with `create or replace`, and **that
restatement is the hazard**: every one is a copy of some earlier version, and a copy taken from
before a mapping was added silently removes it. Only the last `create or replace` survives.

The loss is invisible in review — the diff shows a function being added, not a branch being dropped
— and it surfaces as every write to that table raising `audit_change has no entity mapping`, which
is the feature not working at all. It happened on 2026-08-30: a migration copied the function from
`20260815140000` and dropped `document_blocks`, added eleven days earlier.

So `pnpm check:sql` now holds it: the last restatement must map every table that carries an
`audit_change` trigger. **Copy the function from the most recent migration that restates it, never
from the one you happen to be reading**, and the gate will tell you if you did not.

## Edge functions are a workspace package, not a second toolchain

`supabase/functions/` is TypeScript on Deno (ADR-0020), and it is held to the same `pnpm lint`,
`pnpm typecheck`, `pnpm test` and `pnpm probes` as everything else — ADR-0024 records why, and what
that costs. Three rules follow, and they are the ones easy to get wrong:

- **The decisions go in modules over injected dependencies; `index.ts` is wiring only.** A real
  `fetch`, a real clock, a real client, and nothing that decides anything. It is the one file no
  test reaches, so what lands there is what nothing checks.
- **The function sources compile with `"types": []`.** No `@types/node`, so `node:fs`, `process` and
  `Buffer` fail to compile in a file that would have failed at runtime. Tests are the separate
  `tsconfig.test.json` project and may use them.
- **A shared package reaches Deno as a generated copy, in three places rather than two.** The edge
  runtime mounts this directory and nothing above it, so `deno.json`'s import map points at
  `./_shared/<name>/index.ts` — a git-ignored copy that `scripts/sync-edge-shared.mjs` rebuilds on
  the way into `pnpm functions:serve` and `pnpm functions:deploy` (ADR-0025). tsc still resolves the
  original through `paths`. Importing a new package means the sync list, the import map and the
  tsconfig, and only running the function will tell you if you missed one. **Serve with
  `pnpm functions:serve`, never the bare CLI command** — the bare one skips the copy.

A function that writes as `service_role` bypasses RLS entirely, so **every rule it is subject to is
written in its own code** — and it holds no privileges by default either. The tables here are owned
by `postgres`, where the platform's default grants to `service_role` never reach, so a backend
identity gets `select`, `insert` and `update` from a migration of its own or it gets
`permission denied` on its first real request (`20260902120000` is the worked example; RLS being
bypassed says nothing about privileges, which is how this went unnoticed for three days). `law-article` is the worked example: it checks the caller's role against
the auth server rather than decoding the JWT, and it refuses an act-scoped norm and a normalizer
bump rather than guessing at either.

## Every policy needs a verification scenario

Not a paragraph in a PR description — a **script**, at `snippets/verify_<area>.sql`. It creates its
own fixtures, attempts to break every rule the migration claims to enforce, prints PASS/FAIL per
scenario, and ends in `rollback` so it leaves nothing behind. `snippets/verify_catalogue.sql` is
the worked example: 23 scenarios over the catalogue migration.

Run it against the local sandbox, never against the cloud:

```bash
docker exec -i supabase_db_Legal-AI-UA psql -U postgres -d postgres < supabase/snippets/verify_catalogue.sql
```

Prose is not re-runnable and nobody can check it six months later. A script can be run again the
day someone adds a table that quietly widens a policy.

**Cover the denials, not only the grants.** A denied write under RLS is silent: a `USING` clause
filters the row out, the statement matches nothing, and the client sees an empty array rather than
an error. A scenario that only proves the allowed case proves half of nothing.

**Every `do $$` block states who it is acting as, and hands the session back.** `set local` lasts
for the whole transaction, so a block that declares nothing runs as whoever the block before it
happened to leave behind. That is not hypothetical: one scenario here was passing only because its
predecessor had left a conveniently-assigned lawyer in the session, and detaching that lawyer
turned the check red while the thing it tested worked perfectly. So every block opens with
`set local role …` or `set local request.jwt.claims …`, and closes with:

```sql
  reset role;
  perform set_config('request.jwt.claims', '', true);
```

A block that then forgets to declare itself runs with no role and no claims, gets denied
everywhere, and fails loudly instead of passing for the wrong reason. `pnpm check:sql` enforces
both halves.

**The scripts run in CI, not only by hand** (`.github/workflows/sql.yml`, on any change under
`supabase/`). `pnpm verify:sql` runs the same thing locally against the sandbox. This is the
difference that mattered on 2026-08-12: a `not null` column broke the TypeScript fixtures and the
SQL fixtures identically, and only the TypeScript ones said so, because only they were being
executed by something.

## The one hard review rule

Any migration touching access control (RLS policies, `auth.*`, JWT `app_metadata`, consents)
requires a second reviewer before merge — no self-merge, regardless of who wrote it. Core owner
preferred as reviewer. This is the one exception to the default review matrix in
`docs/CONTRIBUTING.md`. Separately, any migration is automatically Tier 2 (full spec + ADR, see
`docs/CONTRIBUTING.md`) regardless of how small the diff looks.

**Suspended while the team is one developer** — see "While the team is one developer" in
`docs/CONTRIBUTING.md` for what stands in for the reviewer and when the rule comes back. An AI
assistant does not count as the second reviewer of a migration it wrote.
