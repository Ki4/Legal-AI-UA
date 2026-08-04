# ADR-0008: Templates come from uploaded documents, not from a Word add-in

- Status: accepted
- Date: 2026-08-04

## Context

The authoring plan discussed until now put the lawyer inside Word: an add-in task pane where
templates, variables and branching would be authored against the document itself. It was never
built, and the objections that surfaced are about the runtime, not the ergonomics:

- The add-in needs a real Word installation on whatever machine runs it. Our infrastructure is
  containers; Word is not something a container gets.
- Not every lawyer works in Word to begin with, so the add-in would gate authoring on a specific
  desktop product.
- Substituting LibreOffice or a document library is not the same product — a different rendering
  engine with different fidelity, which makes "what the lawyer saw" and "what the client gets" two
  different things.

Separately, the add-in carried the hardest technical risk in the whole authoring design: block
identity had to survive a round trip through a file a human edits by hand. The generation trace is
only meaningful if block ids stay stable across regenerations (see VISION), and hand editing in
Word is exactly what destabilises them.

## Decision

The lawyer's authoring input is an **uploaded document** — a real precedent they already use. The
core extracts the document's logic from it: structure, branching, and the variables the text
depends on. The result is a draft template version that a human then reviews and corrects in the
console.

The **canonical template is structured data in Postgres**, never the uploaded file. The upload is
kept as an immutable provenance artifact: it records what an extraction was derived from and lets a
version be re-extracted later, but nothing in generation reads it.

Zone boundaries follow ADR-0004 unchanged. Extraction and generation belong to the core, reached
only through the Edge Function gateway. Everything around them belongs to the console: upload,
extraction status, review and correction of what was extracted, the field dictionary, versioning,
publication, and test generation.

The questionnaire field dictionary is canonical, per service, and owned by the platform. Blocks
reference field keys; an extraction that invents a field must add it to the dictionary rather than
reference something that does not exist.

**This decision is temporary in one direction only.** The add-in may come back, and nothing here
blocks it: an add-in would simply be a second producer of the same canonical template. What does
not come back is the file as the source of truth.

## Consequences

- No Office dependency anywhere in the platform runtime. Extraction reads an uploaded file in the
  core's own environment; nothing downstream needs Word installed.
- Document format fidelity stops being a round-trip problem. The file only ever enters. Stable
  block ids become a property of our own schema instead of a property of someone's manual edit in
  Word.
- Extraction quality becomes a first-class product concern rather than an implementation detail.
  The console must show what was extracted and make it correctable, because the lawyer remains the
  accountable party for the template — accepting an extraction unread is exactly the failure mode
  this platform exists to avoid.
- An uploaded precedent may carry real client names. Uploads are therefore treated as potentially
  personal-data-bearing: the rule is to upload a depersonalised sample, and the schema records
  whether a human confirmed that, so an unreviewed upload is visible rather than assumed clean.
- Because the questionnaire is data rather than schema, the three GDPR questions
  `docs/CONTRIBUTING.md` requires of any new personal-data field cannot be answered once in a PR
  description. They move onto the field row itself — whether it is personal data, the legal basis,
  the retention period — and a field marked as personal data without the other two must be rejected
  by a constraint rather than by review.
- Trade-off accepted: an extraction step now sits between the lawyer and a working template, so the
  authoring loop is generate → read → correct → regenerate rather than direct manipulation. This is
  slower per iteration than editing in place would have been, and it is the reason saved test
  fixtures and run history are first-wave console work rather than a later convenience.

See `docs/specs/admin-console.md` §4.5, §5.1 for the screens this implies.
