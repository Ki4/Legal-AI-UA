# ADR-0007: Explicit grants for client roles

- Status: accepted
- Date: 2026-08-01

## Context

`supabase/CLAUDE.md` states that nothing in the database is reachable by default and that every
privilege a client role holds is written out in a migration. Bringing up the local sandbox made
it possible to inspect the actual ACLs for the first time, and the claim was not true:
`public.profiles` carried `anon=Dxtm` and `authenticated=rDxtm` — TRUNCATE, REFERENCES, TRIGGER
and MAINTAIN inherited from the platform's default privileges on the `public` schema, alongside
the single SELECT we granted deliberately.

Row Level Security does not constrain TRUNCATE: a role holding it empties the table whatever the
policies say. The privileges were not reachable from a browser — PostgREST exposes only
SELECT/INSERT/UPDATE/DELETE and RPC, so there is no client path to TRUNCATE or DDL — but the gap
between the documented rule and the database was itself the problem: the rule is what future
reviews are measured against.

## Decision

Client roles hold only privileges granted on purpose. A migration
(`20260801120000_explicit_client_grants.sql`) revokes everything from `anon` and `authenticated`
across the `public` schema, revokes the inherited default privileges for the `postgres` role that
owns our objects, and re-grants exactly the one SELECT the console needs.

`service_role` is untouched — it is the trusted backend identity and bypasses RLS by design.

Every future migration grants what its tables need, explicitly. Nothing is inherited.

## Consequences

- The rule in `supabase/CLAUDE.md` is now enforced by the schema, not just asserted in prose.
- A table added without a `grant` line is invisible to clients rather than partly exposed — the
  failure mode is a broken feature during development, which is the safe direction.
- The revoke of inherited defaults applies to objects owned by `postgres`, which is everything
  this repository creates. Objects created by platform-owned roles keep their own defaults; if a
  future Supabase feature creates tables in `public`, its grants must be reviewed separately.
- This was found by having a local sandbox where the ACLs can be queried. Verifying access
  control against a running database — not against the migration text — becomes part of
  reviewing an access-control change.
