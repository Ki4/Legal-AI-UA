# ADR-0014: Access to client data follows assignment, not role

- Status: accepted
- Date: 2026-08-11

## Context

The console has two roles, `admin` and `lawyer`, held in JWT `app_metadata` and set server-side
only. Today they gate platform capability on a single table: an admin may read every row of
`profiles`, a lawyer only their own. No client data exists yet, so the question of who may read it
has never had to be answered.

It has to be answered before the first client-bearing table, because the answer shapes every RLS
predicate written after it. Extending the current shape by default would make "admin" mean "reads
every client's case", which nobody would choose deliberately.

The proposal on the table was to gate access on the client's permission — the lawyer sees the case
if the client allowed it. This fails on its own terms. Under Art. 7(4) consent is not freely given
where refusing it costs the person the service, and a lawyer cannot review a document without
reading it. Presenting a necessity as a choice produces a **weaker** legal position than relying on
the necessity, and operationally it produces a permission that can be withdrawn in the middle of a
review that is already underway.

One more thing has to be said plainly, because a natural-sounding compromise depends on it being
false: **a document is personal data**. It contains the client's name, their address, their
circumstances — that is what it is for. "Sees the document but not the personal data" is not a
separation that can be built.

## Decision

**Role governs platform capability. Assignment governs case data.** These are different axes and
the schema keeps them apart.

- The **assigned lawyer** reads client data for the matters assigned to them. The basis is
  performance of the contract (Art. 6(1)(b)) together with the professional engagement. No consent
  is requested for it; it is stated in the privacy notice.
- An **admin gets no case-data access by virtue of being an admin.** Administration means users,
  the catalogue, versions, billing. Client-bearing screens are depersonalised for an admin by
  default.
- The exception is **break-glass**: an explicit grant, with a recorded reason, time-boxed, written
  to the access log, and the client is notified. It is a row, not a role — which is what makes it
  expire, and what makes it countable.
- **Consent keeps a real job, a different one:** secondary use. Reusing a client's document as a
  precedent or template, a second lawyer reading it for quality control, using it as training
  data. A client can refuse any of these and still receive their document, so the consent is
  genuine. This is the consent that ADR-0008's "upload a depersonalised sample" rule was reaching
  for from the other side.

**Clients do not live in `profiles`.** That table is staff identity, 1:1 with `auth.users`, and it
already carries an admin-wide read policy. Client identity gets its own table, and it is the single
place holding the pseudonym-to-person mapping that ADR-0010 requires. If clients later authenticate
through the same Supabase project, `profiles` is still not where their data goes.

## Consequences

- Every RLS predicate on a client-bearing table keys on assignment or on a live grant, never on a
  role claim alone. The role claim keeps gating the catalogue and administration, where it is the
  right instrument.
- Break-glass has to be loud. An access grant nobody notices is worse than none, because it looks
  like control while providing none — the same argument ADR-0010 makes about an incomplete log.
- Notifying the client on break-glass is a product obligation this ADR creates, not an optional
  courtesy. It is the thing that makes the mechanism self-policing.
- The access log gains its first real consumer, and with it a reason for the retention decision
  ADR-0010 deliberately left open (§7.2).
- Console screens over client data must be built depersonalised-first, with identity revealed by
  assignment or grant. Retrofitting that later means auditing every screen instead of one query
  layer.
- Cost accepted: two access paths to implement and test rather than one role check. The scenario
  per policy that `supabase/CLAUDE.md` already requires is what keeps this honest.
- Under the hard review rule in `docs/CONTRIBUTING.md`, the migrations implementing this need a
  second reviewer and cannot be self-merged.

See `docs/specs/admin-console.md` §7.3 for the model as the console consumes it, and §7.2 for the
retention schedule the access log now falls under.
