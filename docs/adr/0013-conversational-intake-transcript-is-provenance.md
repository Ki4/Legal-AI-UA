# ADR-0013: Conversational intake — the transcript is provenance, the dictionary stays canonical

- Status: accepted
- Date: 2026-08-11

## Context

Client intake was assumed to be a form. `docs/design/design-system.md` §16 already specified the
primitives for a chat channel and stated the invariant that the questionnaire schema is
channel-independent — chat renders the schema rather than forming a parallel data model. What was
open was the channel itself. It is now taken: **the primary client intake is a chat bot.**

That closes a spec question and opens a data-protection one, because the two channels differ in a
way the design spec had no reason to address.

A form is a **closed** collection surface. What is collected equals what was declared, and the UI
enforces it. Every declared field carries the GDPR triad — is this personal data, on what basis,
for how long — on its own row, by the constraint ADR-0008 requires. The set of personal data held
is therefore knowable by reading the schema.

A chat is an **open** one. The client writes free text and will volunteer more than was asked. In
legal intake the surplus is not hypothetical: a person describing a divorce, an inheritance or a
dismissal names children, addresses, diagnoses, accusations. Much of it falls under Art. 9 special
categories — health, religion, sex life, criminal matters — for which the lawful basis comes from
Art. 9(2), not Art. 6. A dictionary with a single `legal_basis` column cannot express that.

The transcript therefore contains personal data with no declared basis and no declared retention,
by construction rather than by mistake. VISION's data-minimisation commitment — "the questionnaire
collects what a document needs, not what might be useful someday" — is not satisfiable at the
point of collection in this channel.

There is a second difference, quieter and just as consequential. A field value from a form is what
the client typed into a labelled box. A field value from a chat turn is an **inference**: something
decided that "we separated in March" means a date in a particular field. That is the same trust
problem the trust layer already solves for document blocks, arriving one layer earlier.

## Decision

**The field dictionary stays canonical and channel-independent.** Chat introduces no parallel model.
An answer that cannot be traced to a field key does not enter generation. Design spec §16 stated
this as a design invariant; it is now a binding data rule.

**The transcript is a raw provenance artifact**, exactly as the uploaded precedent is on the
authoring side (ADR-0008). It is stored, it records what an extraction was derived from, and
nothing in generation reads it. It is not the source of truth for any answer. The two sides of the
platform now have the same shape: an artifact a human produced, an extraction over it, and
canonical structured data as the only thing downstream consumes.

**Extraction sits between the transcript and the answers.** An answer derived from a chat turn
carries its provenance — channel, source turn, confidence — and is `ai_generated` trust until a
human confirms it. **An unconfirmed answer does not feed generation.** The snapshot of answers in
the document passport (§5.3) accordingly records where each answer came from, not only its value.

**The field dictionary gains a special-category marker with its own basis**, because an Art. 9(2)
basis and an Art. 6(1) basis are different statements and one column cannot hold both. A field
marked special-category without an Art. 9 basis is rejected by a constraint, on the same principle
as the existing triad.

**The transcript must be genuinely deletable.** The pseudonymisation scheme in ADR-0010 does not
cover it. That scheme works because event payloads carry only identifiers, so destroying the
pseudonym mapping de-identifies the log; a transcript is raw text with names inside it, and no
mapping exists to destroy. Erasure therefore has **two mechanisms**: drop the mapping for the logs,
hard-delete the transcripts.

**Consent is presented before the first turn**, not before a set of fields, because personal data
can arrive in the client's opening message. The consent gate is a rule of the conversation flow
rather than a screen preceding it.

## Consequences

- Minimisation moves from the point of collection to the point of retention. This is the honest
  position rather than a claim we cannot support, and the mitigation is the transcript's clock in
  §7.2 — the shortest in the schema.
- The trust layer extends from document blocks to answers. `apps/web` must render an answer awaiting
  confirmation, which is the same shape as a block flagged "needs attention" in the console.
- The confirmation step is what restores an auditable record of what the client actually asserted.
  Without it, the only record of a client's position would be a model's reading of their prose,
  which is not something to put behind a lawyer's sign-off.
- A second erasure path exists and has to be tested as such. A deletion that clears the pseudonym
  mapping and leaves transcripts standing is a breach, and it fails silently — everything looks
  deleted from every screen that reads through the mapping.
- Trade-off accepted: chat is materially better for a non-technical client and materially worse for
  provable minimisation. It is taken with the retention schedule as the price.
- Nothing here changes the authoring side. The lawyer's channel remains the console, and the field
  dictionary is edited there exactly as §4.4 describes.

See `docs/specs/admin-console.md` §5.5 for where answers come from, §7.2 for retention, and
`docs/design/design-system.md` §16 for the chat primitives themselves.
