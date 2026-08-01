# ADR-0003: Supabase-first backend

- Status: accepted
- Date: 2026-07-30

## Context

The platform needs authentication, a relational database with row-level access control, file
storage for generated documents, and a gateway layer in front of the AI core. The team is small
and cannot operate bespoke infrastructure for each concern. The platform handles personal data
of Ukrainian clients, so region and access-control decisions carry GDPR consequences.

## Decision

Use Supabase: Auth, Postgres with row-level security (RLS) on every table, Storage, and Edge
Functions as the gateway in front of the AI core. Region: **EU Frankfurt** — a GDPR-driven,
irreversible choice made at project creation.

Roles live in the JWT's `app_metadata`, set **server-side only**, via the `approve_user` RPC
pattern (`supabase/migrations/20260730120000_auth_profiles.sql`): registration creates a profile
with no role, the user sees a pending-approval screen, and an admin grants a role through a
`security definer` function that writes `app_metadata` directly. `profiles.role` is a display
mirror only — no access-control decision trusts it. Implemented and verified live 2026-07-30.

Project-wide: automatic exposure of new tables to the API is **off** (explicit grant per
migration); the auto-RLS-on-new-table trigger is **on**.

Known trap: role changes require a token refresh to take effect. A **demotion** must also
invalidate the user's existing refresh tokens, or the user keeps elevated access until their
access token happens to expire.

## Consequences

- One platform for auth, DB, storage, and access control — appropriate for a three-person team.
- RLS-on-every-table plus explicit grants means a new table is safe by default.
- EU Frankfurt is not revisitable later without a data migration; chosen up front to avoid one.
- The role-in-JWT model requires discipline: every role change must account for the
  refresh-token implication on demotion, or access-control bugs will be silent.
- Edge Functions being the gateway means their wall-clock execution limits become a hard
  constraint on what can run there (see ADR-0004).
