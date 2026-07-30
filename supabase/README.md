# Supabase

Migrations live in `migrations/` and are the only way the schema changes.
Nobody edits the cloud database by hand — the single exception is the one-time
first-admin bootstrap documented inside `20260730120000_auth_profiles.sql`.

Until the Supabase CLI is set up (next iteration), apply a migration by pasting
its contents into the dashboard SQL editor. After the CLI lands: `supabase db push`.

Every migration that touches access control requires a second pair of eyes
before merge — no exceptions.
