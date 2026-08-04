# ADR-0010: Audit is an append-only log with pseudonymous subjects

- Status: accepted
- Date: 2026-08-04

## Context

Two commitments in VISION rest on being able to prove what happened. Lawyer sign-off is meaningful
only if it can be shown who approved what and when, and the GDPR Art. 22 position — that a decision
with legal effect was not taken by automated processing alone — is a claim about process that has
to be evidenced rather than asserted.

A mutable status column on an order evidences nothing. It shows the current value and says nothing
about how it got there or who moved it.

There is also a question nobody asks until it is asked in earnest: _who looked at this client's
data?_ Under GDPR a lawyer opening a client's document has processed personal data even if they
changed nothing, so reads are events too — and reads are exactly what a change-tracking design
misses.

Finally, an audit log and the right to erasure are in direct conflict. The log must be immutable;
the person may demand deletion.

## Decision

**The log is append-only.** Ordered, questionnaire submitted, generation started and finished,
reviewer assigned, review approved or rejected, regenerated, delivered, downloaded, exported,
anonymized. Entries are never updated. Current status is a projection of the log, not a column that
the log describes.

**Events are written server-side, never by the browser.** Data changes are recorded by database
triggers, which no client path can bypass. Reads and calls to the core are recorded by the Edge
Function gateway, because a plain read cannot be caught by a trigger. An audit record the frontend
is trusted to write can be skipped or forged, which means it cannot be relied on — and a log that
cannot be relied on is worse than none, because an incomplete log still gets believed.

**The action log and the access log are separate.** Read volume exceeds write volume by an order of
magnitude and their retention differs; one table serving both serves neither well within a year.

**The client appears in events under a stable pseudonym**, with the mapping from pseudonym to
person held in exactly one place. Erasure destroys the mapping. The log stays intact and stops
being identifying.

**No personal data in event payloads.** Events carry identifiers — an order id, a document id, a
pseudonym — never names, emails or case details. `docs/CONTRIBUTING.md` already required this as
hygiene; under this ADR it is load-bearing, because one name written into a payload defeats the
erasure mechanism above.

## Consequences

- Erasure and immutability stop being in conflict, at the cost of one indirection on every query
  that needs to name a client.
- Because the log is the source of truth for what happened, per-service statistics and the service
  history screen are projections of it rather than separately maintained counters.
- The log must exist from the first migration that creates a domain table. It cannot be
  backfilled: what is not recorded at the time is gone, and a log that starts halfway through is
  not evidence of anything. This is why it is foundation work rather than a later feature.
- Routing client-document reads through the gateway becomes necessary rather than stylistic,
  since a direct table read produces no access record.
- Storage grows monotonically. Retention policy for the access log is a real decision that has to
  be made rather than defaulted, and it is deliberately left open.
- This ADR touches GDPR-relevant fields, so the migrations implementing it fall under the hard
  review rule in `supabase/CLAUDE.md`: a second reviewer, core owner preferred, no self-merge.

See `docs/specs/admin-console.md` §6 and §7 for the three cuts of the log and the GDPR
consequences.
