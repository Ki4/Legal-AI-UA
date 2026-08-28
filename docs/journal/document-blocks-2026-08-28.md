# document_blocks — 2026-08-28

PR #63 records what changed. This records how the session went, which has no PR to live in.

## The recommendation was right and its reasoning was not

The session opened with a question about the data model rather than a task: how easily the current
shape adapts to what `VISION.md` describes, and whether it needs adapting now. `document_blocks` was
proposed as the answer, on two arguments. One held and one did not.

What did not hold: the table was described as the place where a generated document's trace stops
being a fixture, and therefore as the thing that would force **Q27** — where a block's approval
lives — to be decided. Reading the backlog showed that to be the issued document's passport
(ADM-65), a different row entirely. `document_blocks` is the authoring side: the blocks a lawyer
writes on a template version. Q27 was untouched by it.

What held, and held harder once the mistake was corrected: ADR-0013 makes the chat bot's question
order a **projection of block conditions** over the field dictionary, computed rather than authored.
`VISION.md` puts the MVP at tier 1 — templated documents with a conversational intake — so the block
tree is not preparation for `block_assembly` later. It is what drives the conversation now.

The root of the error is worth naming because it is cheap to repeat: `ROADMAP.md` and `STATE.md`
both called the work `document_blocks`, a name that appears in no row of `specs/admin-console.md`
§10. A name that lives in one document and not in the backlog it refers to reads as though everyone
already agrees what it means.

## A gate you learn about from red CI is a gate that is not local

`pnpm db:types` regenerates `packages/db/src/database.types.ts`, and `sql.yml` fails a PR whose
migration made it stale. It is in none of `verify`, `probes`, or the pre-push hook, because it needs
a running Docker and a rebuilt local database — which is a real reason, not an oversight. The cost
is a round trip through CI for a defect that a local run would have shown in seconds.

Nothing was changed about this. If it recurs, the shape of the fix is a pre-push step that skips
silently when Docker is not running — the same bargain `docs:check` already takes on push.

## An instruction can be safe under its premise and harmful under the facts

The session closed with a request to run `snippets/repair_migration_ledger.sql` against the cloud,
with the reasoning that the line for `20260828120000` was already in it — which was true, and which
had been written in this session's own summary. Under its stated premise the instruction was
correct.

The facts were different. `supabase migration list --linked` showed the cloud's ledger stopping at
`20260814120000`: **five** migrations unrecorded, not one, with the drift running back two weeks.
The repair script marks every migration in it as applied. Had it been run without knowing whether
the schema was actually present, and had it not been, `db push` would have skipped four tables
forever — the failure the script's own header calls worse than an unrecorded migration.

The schema turned out to be there; the repair was the right action, and `supabase migration repair
--status applied` performed it with credentials the script's `psql` path did not have. But the
sequence is the point: a read before a write into a database this repository cannot see. The
password is not in the working tree, which meant the confirming query had to come from the person
rather than from the tool — and that is the case where asking is the work, not an interruption to
it.

The drift itself is now a debt in `STATE.md`. Every gate in this repository verifies against a local
stack, so nothing ever asks the cloud whether it agrees, and two weeks of divergence produced no red
anywhere.

## What was left alone

The two link tables — a block's questionnaire fields (ADM-20) and its law dependencies (ADM-22) —
were kept out of the migration rather than folded in. Each needs a cross-service trigger of its own,
since a field belongs to a service and a block to a version, and together they would have doubled a
PR that `CONTRIBUTING.md` already wants under 400 lines.

`document_blocks` also went into `seed.sql` nowhere, which was noticed at session close rather than
during the work. It is the only domain table without seed rows, and no gate compares the two lists.
That is recorded as a debt rather than fixed here, because the screen that will need those rows
(ADM-13) is not being built yet and the shape of a useful fixture is a decision that screen makes.
