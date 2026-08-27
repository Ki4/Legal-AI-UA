# Vision

## What this is

Legal-AI-UA is a legal services platform for Ukrainians. A client orders a legal document
through the web platform, a questionnaire collects the relevant facts, an AI pipeline generates
the document, and — depending on the service type — a lawyer reviews it before delivery.

## Who it serves

- **Clients** — Ukrainians who need a legal document (a claim, a complaint, a contract, a
  power of attorney) without hiring a lawyer for the whole process.
- **Lawyers** — review AI-generated output where the service requires it, author the templates
  and blocks the AI assembles from, and stay the accountable party for anything with legal
  consequences. Some are listed on the platform for reach and author nothing — see "A provider is
  not a tenant" below.
- **Admins** — approve new lawyer/admin accounts and operate the platform.

Lawyers are served in two capacities that are easy to conflate and cost different things to build.
They are **staff** of a practice, and they are **customers of ours** — the platform sells them reach
and tooling on a subscription. The first is what the console is; the second is what the platform
becomes. Nothing in the schema distinguishes them today, and nothing needs to until the first lawyer
who is not our own staff signs in.

## Four ways a need is met

A client arrives with a need, not with a preference about how it is served. The platform answers in
one of four ways, and the first three are the same machine at three settings:

|     | What the client gets                                | Who is in the loop | Cost                  |
| --- | --------------------------------------------------- | ------------------ | --------------------- |
| 1   | A templated document, filled from their answers     | nobody             | cheapest, immediate   |
| 2   | A document assembled from lawyer-authored blocks    | a lawyer, always   | more                  |
| 3   | A drafted document a lawyer reads and stands behind | a lawyer, always   | most                  |
| 4   | A lawyer                                            | only a person      | not a document at all |

**Tiers 1 to 3 are already the two axes of a service version.** `generation_mode` says how the text
is produced and `review_mode` says whether a person signs it off, and the constraint between them —
only `template` may run unreviewed — is what makes tier 1 a configuration rather than a risk. Tier 3
is not a different product from tier 2; it is the same row with the console read as a lawyer's
instrument rather than an administrator's panel. Making that lawyer faster is the whole of the value
we add at that tier.

**Tier 4 is genuinely different and the schema does not carry it yet.** Every order today must end in
a document: the lifecycle leads to `delivered`, and delivery checks the pinned version, the reviewer
and the entitlement. A consultation has no template, no version and no file. It is still a service —
somebody sells it, somebody is accountable for it, somebody must be able to ask later what happened —
so it belongs on the same spine with a third axis on the version saying what is delivered, rather
than in a second table of leads with its own funnel, its own statistics and its own audit story.

The reason to record a consultation at all, even where no money moves through us, is **attribution**.
"We sent you eleven clients this month" has to be a query.

## A provider is not a tenant

The platform lists lawyers who are not our staff. They came for reach: a client picks a service, or
picks a person, or talks to the intake bot until it is clear that what they need is a person — and
lands on a lawyer who is on the platform. Some of those lawyers also author and review the automated
services; most will not.

This looks like multi-tenancy and it is not, and the distinction is worth several months.

- **A provider is a listing.** A public profile, practice areas, a bar certificate, a way to be
  reached, a subscription to us for being there. Nothing about it needs isolation, because the
  profile is public by design.
- **A tenant is an isolated workspace.** A firm running its own practice here: its own catalogue, its
  own staff, its own clients, with a hard guarantee that no row of one firm is reachable from
  another.

The platform needs providers early and tenants late. Nothing in the four tiers above requires a
second isolated catalogue.

What the provider does need is already half-built. A lawyer's participation is decided by
`service_assignments`, not by their role: an external lawyer holds the `lawyer` role with **no
assignments**, our own lawyer holds the same role with them. The two ends of the same spectrum, and
one table already tells them apart. Competences (§5.6 of the console spec) gain a second and stronger
purpose here — they stop being an internal hint for the assignment picker and become the shop window
a client chooses from, which is what makes Q20 (does a competence carry evidence?) a question about a
public claim rather than about internal hygiene.

**One precondition, and it has a deadline rather than a priority.** Around a dozen policies are
written as "any member of staff" — `using (jwt_role() in ('admin','lawyer'))` — because today every
member of staff is one firm's. `clients_select_staff` is among them, which means the day an external
lawyer can register is the day every registered lawyer can read every client anchor on the platform.
Pseudonymous, so no name leaks; the volume and the timing still do. The failure is silent, as this
class of failure always is: nothing raises, no gate reddens, the rows are simply visible to people
they were never meant for. **Before external registration opens, every one of those policies answers
"platform-wide or own practice?" explicitly, and answers it through a named predicate rather than a
literal repeated in each file.** The verification scenario to write first is the mirror of the `anon`
one: a lawyer with no assignments sees no row of any table they have no business in.

## The business client, and the subject of a document

A sole proprietor with employees — the medical practice in the section below is the worked example —
does not order one document. They maintain a set of them, per person, on a clock: a contract, an
appointment order, a safety briefing, a health record with an expiry. That is a subscription
customer with an administrator, and it is the strongest case for the cabinet the client platform
becomes.

It also breaks an assumption the schema currently makes quietly: **that a document is about whoever
ordered it.** A practice ordering an employment contract for a named employee introduces a person who
is not the account, not a member of it, and not a user of the platform at all — and whose personal
data is in the document.

The answer is the shape `clients` and `client_identities` already use, applied a second time: a
pseudonymous subject anchored to the account, and its mapping to a person in one table that erasure
deletes. Orders gain an optional subject. Everything that counts, joins or reports keeps touching no
person.

The consequence that is not technical: **for employee data the business client is the controller and
we are the processor.** That is a different legal relationship from the one we have with a client
ordering their own divorce petition — a different contract, retention decided by them rather than by
§7.2, and an erasure request that arrives from the practice rather than from the employee.

## What we prove first

The MVP is **tier 1 only**: templated documents, and an intake that is close to a bare chat bot. The
client says what they need, the bot settles which service it is, they order, and the package arrives
in the same conversation. No catalogue to browse, no cabinet, no provider directory.

This is a proof of concept in the literal sense — the thing being proved is that people will describe
a legal need to a bot and pay for what comes back. Everything above waits on that answer, and none of
it is cheaper to build before it.

Two things follow for how the rest is prepared, and they pull in opposite directions on purpose.

**What is laid in now** is what a later retrofit would have to reach into live client data to
change: an answer records where it came from from the very first one (§5.5 — channel, source turn,
confidence, and `ai_generated` trust until a human confirms), because the MVP's intake is already
conversational and provenance cannot be reconstructed afterwards; a document's passport is designed
whole even where the MVP leaves half of it null; the order spine keeps pinning a frozen version.

**What is not built** is everything whose shape the proof of concept might change: the provider
directory, the tenant, the review queue, the client cabinet. Recording the decision is not the same
as taking it, and this file is where the decisions are recorded.

## Generation modes

Every service version carries a `generation_mode` and an independent `review_mode`. The mode is
data, not a hardcoded path:

| Mode              | What happens                                                        | Review                                                                 |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `template`        | Deterministic fill-in of a lawyer-authored template                 | Can be automated (lawyer configures the template)                      |
| `block_assembly`  | AI assembles the document from pre-approved, lawyer-authored blocks | Always lawyer in the loop                                              |
| `full_generation` | AI generates the text                                               | Always lawyer in the loop, with a review UI that highlights AI content |

`auto` review is only available for `template` mode, and only for documents that carry no legal
consequences for the person ordering them. Every automated order still offers a "request human
review" option — this is both a GDPR Art. 22 obligation and a deliberate product choice, not a
compliance afterthought.

## Document anatomy — the differentiator

Every generated document carries a **generation trace**: a per-block record of what produced
that block and why. Each block in the trace has:

- a **trust status** — `template`, `ai_generated`, or `lawyer_edited`
- **questionnaire field references** — which client answers fed this block
- **law article references**, each with a verification date
- the **branching conditions** that selected this block
- the **core tool calls** that produced it
- a **`needs_attention` flag**

Block IDs are stable across regenerations, so a re-run of the pipeline (after a questionnaire
edit, a law update, or a lawyer correction) doesn't scramble the trace — it updates it.

One trace, two consumers:

1. **Lawyer review screen** — uses the trace to highlight exactly what needs checking:
   AI-generated blocks, low-confidence branching, missing law references.
2. **Client-facing anatomy view** — the same trace, presented as "here is what this document is
   built from and why," turning a black-box AI output into something a client can inspect.

This is the platform's flagship feature. It is what the review UI is built around, what makes
lawyer sign-off meaningful rather than a rubber stamp, and what distinguishes the product from a
plain AI document generator.

## One-off documents and subscription — both

Some client needs are one-off (a single contract, a single complaint). Others are recurring — a
medical sole proprietor, for example, has a stream of periodic filings and obligations tied to one
legal status. The product serves **both**: a one-off purchase covering a document or a set of
them, and a subscription to the platform whose plan decides which services it covers.

The order spine (client → questionnaire → generation → review → delivery) serves either model, so
this decision changed no structure. What it did add is a promise with teeth: a document stays valid
until the law it rests on changes, which is why legislative-change monitoring exists at all.
Pricing is in UAH, and the amounts are still open.

See `docs/specs/admin-console.md` §8 for the commercial model, §8.6 for what an entitlement
records, and §9 for the monitoring machinery the promise depends on.

## GDPR posture

- **Human-in-the-loop is a value, not just a checkbox.** Lawyer review for consequential
  documents satisfies GDPR Art. 22 (no decision with legal effect based solely on automated
  processing), and the document anatomy view is what makes that review substantive.
- **Consents are versioned documents**, not booleans. What a client agreed to, and which version
  of the text they agreed to, is recorded and retrievable.
- **Data minimization.** The questionnaire collects what a document needs, not what might be
  useful someday.
- **Anonymization, not deletion, for accounting data.** Where retention law requires keeping
  financial records, personal identifiers are anonymized rather than the record deleted, so the
  platform can honor both an erasure request and a statutory retention requirement.
