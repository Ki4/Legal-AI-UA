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
  consequences.
- **Admins** — approve new lawyer/admin accounts and operate the platform.

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
