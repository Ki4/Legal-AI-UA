# ADR-0017: Sequence privileges are explicit; RLS coverage is checked, not patched

- Status: accepted
- Date: 2026-08-13

## Context

Two objects live in the cloud project that no migration creates. Both were found by `supabase db
diff` on 2026-08-13, once the CLI was linked, and both were deliberately left alone at the time
pending a decision. This is that decision.

1. `alter default privileges … revoke update on sequences` for `anon`, `authenticated` and
   `service_role`.
2. An `ensure_rls` event trigger, paired with an `rls_auto_enable` function, which switches row
   security on by itself for any newly created table.

They arrived together and look like one problem — the cloud holds things the repository does not —
but they are two problems, because the right answer to each is different.

**The first is a gap in ADR-0007, patched in the wrong place.** ADR-0007 made "explicit grants
only" true for tables and did not cover sequences, reasonably, because at that point `public`
contained none. It contains one now, and it is the worst one to leave inherited:

```
audit_events_id_seq   anon=w   authenticated=w   service_role=w
```

`w` is UPDATE, which is the privilege `setval()` requires. `audit_events.id` is `bigint generated
always as identity primary key`, so a sequence wound back to 1 makes the next insert collide with a
row that already exists. The audit trigger is `SECURITY DEFINER` and fires on domain tables, so that
failing insert takes the domain write with it — one `setval` and the catalogue stops accepting
changes. ADR-0010 built the log so that what happened could not be edited away; an inherited
privilege is a way to stop it recording instead.

Severity, stated as plainly as ADR-0007 stated its own: **not reachable through the Data API
today.** `setval()` lives in `pg_catalog`, PostgREST exposes RPC only from the exposed schema, and
there is no path from a browser to either. This is defense in depth. The reason to fix it is the one
ADR-0007 gave — the gap between the rule in `supabase/CLAUDE.md` and the database is itself the
problem, because the rule is what future reviews are measured against.

**The second is not a gap. It is a different mechanism, and it has a cost that is easy to miss.** A
trigger that enables RLS by itself removes the mistake and the evidence in the same motion. The
migration that forgot `enable row level security` still forgot it; the author never finds out; the
review never sees it; and the two environments disagree about what protects a table — the cloud is
covered, and the sandbox, which is where mistakes are supposed to surface, runs without the net.
That is backwards.

There is a second problem specific to copying it. Nobody in this repository has read that function's
body. Authoring our own definition and pushing it would replace a production safety object with a
guess — the failure the same day's journal already named, where knowing which instrument to reach
for required looking rather than assuming.

## Decision

**1. Sequences get the treatment ADR-0007 gave tables.**
`20260813120000_explicit_sequence_grants.sql` revokes on the sequences that exist and revokes the
default privileges governing the ones that do not exist yet. The second half is the one that
matters: a one-time revoke protects today's single sequence and nothing anybody adds later.

**2. `service_role` is included, where ADR-0007 deliberately left it out.** Two reasons, stated so
this reads as a decision and not an inconsistency. It is what the cloud already had, so revoking
from the same three roles is what makes the environments agree rather than half-agree. And
`service_role` already holds no DML on public tables — noted in the 2026-08-11 journal — so the
gateway will have to be granted what it needs explicitly when it lands (ADM-5). Sequences join that
list instead of becoming a second exception with a different shape.

**3. RLS coverage is asserted, not automated.** Scenario 6 of `snippets/verify_grants.sql` fails
when any table in `public` lacks row security, names the table, and runs in CI on every change under
`supabase/`. A migration that forgets the line goes red in review rather than being silently
corrected in production.

**4. The cloud's `ensure_rls` trigger is neither copied nor removed today.** It stays as an
**accepted divergence**, recorded here rather than in a diff nobody reruns — on the condition that it
is treated as a net and never as the mechanism. The mechanism is the rule in `supabase/CLAUDE.md`
plus the check in point 3. Whether to keep, capture or drop the trigger is answered by someone
reading its definition against the production database, which is a separate act from this migration
and needs access this one did not require.

## Consequences

- The rule in `supabase/CLAUDE.md` is now true of sequences as well as tables, and enforced by the
  schema rather than asserted in prose.
- **A future migration whose table needs a sequence privilege has to grant it.** That is the
  intended cost, and it is the same one ADR-0007 accepted: the failure mode is a broken feature in
  development rather than a privilege nobody asked for in production.
- `service_role` now holds nothing on public sequences. The gateway (ADM-5) grants what it needs
  explicitly — it already had to for tables, so this adds no new kind of work.
- **Scenario 6 was added while it is green.** All eight tables have row security today. A check
  introduced the day it first goes red is a debugging tool; one introduced while it passes is a
  gate, and this is the only moment it can be the second thing.
- Both new assertions were confirmed to fail when the invariant is broken — the grant restored, and
  a table created without RLS — rather than merely observed to pass. A scenario that has never been
  seen red is not evidence, which is the 2026-08-11 lesson applied to its own successor.
- **Sequence operations are not transactional, and that probe proved it the expensive way.**
  Restoring the grant and calling `setval(seq, 1)` inside a transaction, then rolling back, left the
  sandbox's audit sequence at 1: `rollback` does not undo a sequence write. Every verification script
  that ran afterwards died on a primary key collision it had not caused. Two things follow. The
  severity argument above is not theoretical — the damage a stray `setval` does is damage no
  transaction takes back. And the first draft of `verify_grants.sql` carried the same landmine: it
  attempted the destructive form of the call, which is safe only while it keeps being denied, so the
  day the revoke regressed the script would have proved it by corrupting the sandbox it verifies.
  Scenarios 1–3 now attempt `setval` with the sequence's own current value, read back first as the
  owner — the same privilege check, no blast radius.
- The `storage` schema keeps its own default privileges for the client roles. Out of scope
  deliberately: it is platform-owned, and ADR-0007 scoped this rule to `public`.
- **One divergence remains, and it is now written down instead of remembered.** If the `ensure_rls`
  function is ever read and turns out to do more than switch row security on, this ADR is the record
  saying nobody had checked when the decision was taken.

See `docs/adr/0007-explicit-grants-for-client-roles.md` for the rule this extends,
`docs/adr/0010-append-only-audit-with-pseudonymous-subjects.md` for what the one sequence sits
behind, and `supabase/CLAUDE.md` for the verification-script requirement this migration ships
against.
