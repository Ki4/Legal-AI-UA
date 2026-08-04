# Admin console — screens, metadata and audit

- Status: draft for discussion
- Date: 2026-08-03
- Audience: the two developers building the console, plus the core owner for the zone boundary

This is one document on purpose: the screen map, the user stories, the metadata model behind them,
and the backlog all constrain each other, and reading them apart is how they drift.

## 1. Assumptions

Everything below is written as if **document generation and extraction already work**. They are
the core owner's zone (ADR-0004, ADR-0008) and the console is built around them, not with them.
Where the console needs the core, it needs it through the Edge Function gateway and nowhere else.

Two frontend developers work on this in parallel. Section 11 is the split.

## 2. Zone boundary

| Concern                                                              | Owner         |
| -------------------------------------------------------------------- | ------------- |
| Reading an uploaded file, extracting structure, variables, branching | Core          |
| Generating a document, producing the trace                           | Core          |
| JWT check, rights check, audit write, calling the core               | Gateway       |
| Everything a human sees and clicks                                   | Console       |
| Schema, RLS, grants, triggers                                        | Product owner |

The console never calls the core directly. If a screen needs something the core produces, it
queues work and reads the result — it does not wait on a synchronous call to a long-running
pipeline.

## 3. Information architecture

```
/services                  service list
/services/:id              service card → overview
/services/:id/versions     versions, with archive behind a filter
/services/:id/fields       questionnaire: the variable dictionary
/services/:id/template     template: blocks and branching
/services/:id/runs         test runs and their history
/services/:id/stats        per-service statistics
/services/:id/history      who changed what
/law                       law reference register
/team                      team (admin only)
/account                   own profile
```

Two decisions are baked into this map.

**Versions and the archive are not a top-level section.** They are a tab on the service card, and
the archive is a filter on that tab. A separate "archive" entry in the sidebar creates a dead
section nobody visits.

**The service card is a layout route with an `<Outlet/>`.** Each tab is its own feature
contributing its own child route. This is not cosmetic — it is the precondition for two people
working in parallel. If the tabs are branches of one component, both developers edit the same file
every day. The layout itself lives in `src/app/`, not inside a feature, so that no feature imports
from a sibling (the rule in `apps/console/CLAUDE.md`).

## 4. Screens and user stories

### 4.1 Service list — `/services`

Columns: title, generation mode, review mode, status, current published version, assigned lawyer,
created, last changed, price. Filters by status, mode and lawyer. Search by title. Sort.

- As an admin, I see every service with its status and mode, so I know what is currently on sale.
- As an admin, I filter by status, so drafts stop competing with live services for my attention.
- As an admin, I see who a service is assigned to, so I know who to ask about it.
- As an admin, I create a service and land straight in its card.

### 4.2 Overview — `/services/:id`

Title, slug, description, assigned lawyer, dates, which version is live, quick actions: new
version, pause, reassign.

- As an admin, I see at a glance which version is live and since when.
- As an admin, I reassign a service to another lawyer, and the change is recorded.
- As an admin, I pause a service, so it stops accepting orders without being deleted.

### 4.3 Versions — `/services/:id/versions`

Table: number, status, generation and review mode, price, bound template version, who published
and when. Archive hidden behind a toggle, off by default.

- As an admin, I see every version with dates and publishers, so I can reconstruct what changed.
- As an admin, I create a new version from the current one, so I can edit without touching what is
  live.
- As an admin, I publish a version and the previous one is archived automatically, so exactly one
  version is ever live.
- As an admin, I cannot publish a service version whose template is not published.
- As an admin, the archive is hidden by default, so it does not crowd the list.

### 4.4 Questionnaire fields — `/services/:id/fields`

Key, label, type, required, personal-data flag with legal basis and retention. Drag to reorder.

- As a lawyer, I see all variables of a service in one list, so I know what the client is asked.
- As a lawyer, I add a field with a type and a label, so the template can reference it.
- As a lawyer, marking a field as personal data forces me to state a legal basis and a retention
  period — the field will not save without them.
- As a lawyer, I see how many blocks use a field, and I cannot delete one that is in use.

### 4.5 Template — `/services/:id/template`

Upload of the source document and extraction status. Block tree: title, text, branching condition,
linked fields, linked law articles, "needs attention" flag. Condition editor.

- As a lawyer, I upload my own precedent and see that extraction has started.
- As a lawyer, I see the extraction status and, if it failed, why — and I can retry.
- As a lawyer, I see the structure the AI extracted, so I can check it.
- As a lawyer, blocks flagged "needs attention" come first, so I do not have to read everything.
- As a lawyer, I edit a block's text and its condition, to correct what was extracted wrongly.
- As a lawyer, I cannot edit a published template version — I create a new one.

### 4.6 Runs — `/services/:id/runs`

Saved answer fixtures, run history, download, trace, comparison.

- As a lawyer, I save a set of test answers, so I do not refill the questionnaire on every
  iteration.
- As a lawyer, I run generation against a chosen fixture and download the result.
- As a lawyer, the trace tells me which block produced which paragraph and which condition fired,
  so I know what to fix rather than guessing.
- As a lawyer, I compare two runs, to see what my correction actually changed.

### 4.7 Statistics — `/services/:id/stats`

Honest scope for the first wave: number of runs, success rate, share of blocks flagged "needs
attention", date of last publication, freshness of law references. Orders, conversion and review
turnaround arrive with orders — before that this screen would be an empty dashboard.

- As an admin, I see whether this service's template is converging or still churning.
- As an admin, I see when its law references were last verified.

### 4.8 History — `/services/:id/history`

Publications, reassignments, template edits — a projection of the audit log filtered to this
service.

- As an admin, I see who changed what and when, without asking anyone.

### 4.9 Law register — `/law`

Code, article, link, verification date. A "needs rechecking" report.

- As a lawyer, I record that I verified an article on a date, so its citations stay trustworthy.
- As a lawyer, I see which articles have not been rechecked in too long.
- As a lawyer, I see which templates and which issued documents depend on an article (see §8.2).

### 4.10 Team — `/team`, admin only

- As an admin, I deactivate a lawyer to close access without erasing their history.
- As an admin, I change the role of an already-approved user.

### 4.11 Account — `/account`

- As any user, I change my password, language and theme.

## 5. Metadata

Two different things get called "metadata" here. Keeping them apart is the whole point of this
section.

### 5.1 Template metadata — about the service

Version, author, the uploaded source file, blocks, conditions, the field dictionary, law
references. This is what §4.4–4.6 edit.

### 5.2 Issued-document metadata — about one client's copy

This is what audit is actually about, and none of it exists in the schema yet.

### 5.3 The document passport

Every issued document carries a record from which, two years later, its origin can be
reconstructed:

- the service version and template version — **by id, never "the current one"**
- a snapshot of the client's answers at generation time
- the generation trace as it stood at delivery
- the hash of the delivered file, its storage path, format and size
- who reviewed it, what they changed, when they approved
- which versions of which consents the client accepted
- when and through which channel it was delivered
- every regeneration: what triggered it and how the result differed

### 5.4 The pinning rule

**A document references a specific template version, and a published version is frozen.**

Only both together make the passport mean anything. Without freezing, a version id proves nothing,
because what sits behind it could have changed.

The consequence is a product rule, not just a schema one: _editing a published service must not
exist as an operation_. There is only issuing a new version. One version live at a time, the live
one not editable, publication archives its predecessor.

## 6. Audit

### 6.1 An append-only event log, not a status column

Ordered, questionnaire submitted, generation started, generation finished, reviewer assigned,
review approved, review rejected, regenerated, delivered, downloaded, exported, anonymized.
Nothing is updated; entries are only appended. Current status is a projection of the log.

The reason is not tidiness. The GDPR Art. 22 defence and the meaning of a lawyer's sign-off both
rest on being able to prove who did what and when. A mutable status column proves nothing.

A side benefit: the per-service statistics in §4.7 are computed from this same log. No separate
counters.

### 6.2 Three cuts of one log

| Question                            | Cut         | What the event must carry        |
| ----------------------------------- | ----------- | -------------------------------- |
| What happened to this document      | by document | document id                      |
| What has this staff member done     | by actor    | user id + their role at the time |
| Whose data was touched, and by whom | by subject  | client pseudonym + a PII flag    |

The third cut is different in kind. It is not about actions on a document but about **access to
personal data**, and reads belong in it. A lawyer who opened a client's document has processed
personal data, even having changed nothing.

Practical consequence: keep the action log and the access log separate. Read volume exceeds write
volume by an order of magnitude and their retention differs; one table serving both becomes
awkward for both within a year.

### 6.3 Who writes it

Not the browser. The console runs as the user's own role, and an audit record the frontend is
trusted to write can be skipped or forged — which means it cannot be relied on.

- Data changes: database triggers. No client path can bypass them.
- Reads and core calls: the gateway, because a plain read cannot be caught by a trigger.

This is an argument for routing client-document reads through the gateway rather than querying the
table directly. Otherwise the access log is incomplete — which is worse than having none, because
an incomplete log still gets believed.

### 6.4 No personal data in event payloads

Events carry identifiers, never names, emails or case details. `docs/CONTRIBUTING.md` already says
this; §7.3 is why it becomes load-bearing rather than merely good hygiene.

## 7. Client, consents, GDPR

- **Consents are versioned documents, not booleans.** What the person accepted, in which revision,
  on what date.
- **Data export** requires that everything holding personal data is reachable from a client id.
  That is a design requirement on the schema, not a feature to bolt on later.
- **Erasure is anonymization** wherever retention law requires keeping financial records.
- **Retention lives on the questionnaire field**, not on the whole record.

### 7.1 The contradiction, and how it resolves

An audit log must be immutable. The right to erasure requires deleting a person's data. These are
in direct conflict.

The standard resolution: in audit events the client appears under a stable pseudonym, and the
mapping from pseudonym to person lives in exactly one place. Erasure destroys the mapping. The log
stays intact and stops being identifying.

This is what makes §6.4 load-bearing: a single name accidentally written into a payload breaks the
scheme.

## 8. Commercial model

Decided: **both one-off purchase and subscription.**

- One-off — a specific document or package, around €130, promised valid until the law changes.
- Annual subscription — around €40/month, documents kept up to date, plus additional features.

Prices are in EUR.

### 8.1 What this demands that nothing else did

"Valid until the law changes" turns a document's lifetime into a function of legislation rather
than of a date. To honour it, the platform must be able to answer: **which issued documents are
affected by this article changing?**

That is a reverse index: `law article → blocks → template versions → issued documents`. It has to
be designed in from the start, because it constrains how blocks, citations and passports reference
each other.

### 8.2 `verified_at` stops being hygiene

The verification date on a law reference was, until this decision, good practice. It is now the
mechanism behind a paid promise. The "needs rechecking" report in §4.9 is what the subscription is
sold on.

### 8.3 One mechanism, two entitlements

Both models need staleness tracking. A one-off buyer was also promised validity, so they must also
be told when their document goes stale. The difference is not whether we track it — it is what
happens next: a subscriber gets the refreshed document, a one-off buyer gets a notification and an
offer.

So this is **one mechanism plus an entitlement record**, not two systems. The entitlement says what
was bought, until when, and covering which services.

### 8.4 Re-issue on a law change

A new operation, and a bulk one: regenerate everything affected. Each re-issue produces a new
document version for the client while leaving the previous passport untouched — a client's document
now has versions of its own, and the passport records the chain.

### 8.5 Notifications move into the core scope

A promise of freshness with no delivery channel is not a promise. Notifications were on the
deferred list; the subscription decision takes them off it.

## 9. Backlog

Sizes are relative: S ≈ a day, M ≈ a few days, L ≈ a week or more, and L items are candidates for
splitting before they become issues.

### Foundation — blocks everything

| ID    | Task                                   | Depends | Size |
| ----- | -------------------------------------- | ------- | ---- |
| ADM-1 | Document metadata schema               | —       | L    |
| ADM-2 | Authoring-loop schema (fixtures, runs) | ADM-1   | M    |
| ADM-3 | Core contract + trace schema           | —       | M    |
| ADM-4 | File storage and its access rules      | ADM-1   | S    |
| ADM-5 | Gateway skeleton                       | ADM-3   | M    |
| ADM-6 | Event log + change triggers            | ADM-1   | M    |

ADM-6 is in the foundation and not in a later wave for one reason: a log cannot be backfilled.
Whatever is not recorded when it happens is gone.

### Catalogue

| ID     | Task                         | Depends | Size |
| ------ | ---------------------------- | ------- | ---- |
| ADM-7  | Service list on live data    | ADM-1   | S    |
| ADM-8  | Create and edit a service    | ADM-1   | S    |
| ADM-9  | Service versions             | ADM-1   | M    |
| ADM-10 | Assign a service to a lawyer | ADM-1   | S    |

### Upload and extraction

| ID     | Task                        | Depends | Size |
| ------ | --------------------------- | ------- | ---- |
| ADM-11 | Document upload             | ADM-4   | M    |
| ADM-12 | Trigger extraction          | ADM-5   | S    |
| ADM-13 | Extraction status and retry | ADM-12  | M    |

### Template

| ID     | Task                        | Depends        | Size |
| ------ | --------------------------- | -------------- | ---- |
| ADM-14 | Block tree                  | ADM-13         | M    |
| ADM-15 | Block editor                | ADM-14         | M    |
| ADM-16 | Branching condition editor  | ADM-14, ADM-18 | L    |
| ADM-17 | "Needs attention" surfacing | ADM-14         | S    |

### Field dictionary

| ID     | Task                       | Depends        | Size |
| ------ | -------------------------- | -------------- | ---- |
| ADM-18 | Field list and editing     | ADM-1          | M    |
| ADM-19 | GDPR attributes on a field | ADM-18         | S    |
| ADM-20 | Field ↔ block links        | ADM-14, ADM-18 | S    |

### Law references

| ID     | Task                                       | Depends        | Size |
| ------ | ------------------------------------------ | -------------- | ---- |
| ADM-21 | Article register                           | ADM-1          | S    |
| ADM-22 | Link articles to blocks                    | ADM-14, ADM-21 | S    |
| ADM-23 | "Needs rechecking" report                  | ADM-21         | S    |
| ADM-24 | Impact index: article → affected documents | ADM-21, ADM-30 | M    |

### Authoring sandbox

| ID     | Task                       | Depends       | Size |
| ------ | -------------------------- | ------------- | ---- |
| ADM-25 | Test fixtures              | ADM-2         | M    |
| ADM-26 | Run a test generation      | ADM-5, ADM-25 | M    |
| ADM-27 | Run result and download    | ADM-26        | S    |
| ADM-28 | Trace view                 | ADM-26, ADM-3 | M    |
| ADM-29 | Run history and comparison | ADM-26        | M    |

### Publication

| ID     | Task                       | Depends       | Size |
| ------ | -------------------------- | ------------- | ---- |
| ADM-30 | Publish a template version | ADM-1         | M    |
| ADM-31 | Publish a service version  | ADM-9, ADM-30 | S    |
| ADM-32 | Pause and archive          | ADM-9         | S    |

### Access

| ID     | Task                                     | Depends | Size |
| ------ | ---------------------------------------- | ------- | ---- |
| ADM-33 | Deactivation and role change             | —       | M    |
| ADM-34 | Invitations instead of self-registration | —       | M    |
| ADM-35 | Lawyer profile card                      | ADM-1   | S    |
| ADM-36 | Own account screen                       | —       | S    |

### Cross-cutting

| ID     | Task                                    | Depends | Size |
| ------ | --------------------------------------- | ------- | ---- |
| ADM-37 | i18n uk/en                              | —       | M    |
| ADM-38 | Loading / empty / error / denied states | —       | M    |
| ADM-39 | Per-service statistics from the log     | ADM-6   | M    |
| ADM-40 | Service history screen                  | ADM-6   | S    |

### Deferred but now unblocked by §8

Orders and the order card; the per-order review queue; the client card, consents and GDPR
operations; entitlements; staleness detection and bulk re-issue; notifications; payments and
payouts. These wait on `apps/web` and on real orders, not on an unanswered product question any
more.

## 10. Waves

**Wave 1 — foundation.** ADM-1…6. Until this stands, one developer has no data and the other has
no contract. ADM-33 and ADM-36 can run alongside: they depend on nothing and are a good way to warm
up against live Supabase.

**Wave 2 — the service exists as an entity.** Catalogue, upload and extraction, field dictionary.

**Wave 3 — the loop closes.** Template editing and the sandbox. This is where the console first
becomes useful to a lawyer.

**Wave 4 — around it.** Law references, publication lifecycle, cross-cutting concerns.

## 11. Two developers in parallel

Split by vertical, not by layer. "One writes the API, the other the UI" produces continuous
blocking.

**Developer A — catalogue and lifecycle.** `features/services`, `features/service-detail` (layout
plus overview), `features/service-versions`, `features/service-stats`, `features/service-history`.
Publication, pause, archive, lawyer assignment.

**Developer B — service content.** `features/service-fields`, `features/service-template`,
`features/service-runs`. Upload, extraction status, block tree, condition editor, fixtures, runs,
trace.

The load is roughly even, but B carries more risk: the branching condition editor (ADM-16) is the
hardest item on the list. `/law`, `/team` and `/account` go to whoever frees up first.

**Both can start before the database exists.** The repo already requires components to reach data
only through their feature's own `api/`. Agree those signatures on day one and hand them over as
mocks, and both write screens in parallel; swapping mocks for Supabase later touches no component.

### Four places they will still collide

1. **`routes.tsx`** — one import and one spread per feature, by the repo rule. Trivial conflicts,
   but constant.
2. **The sidebar in `AppShell`** — both add entries. Give the file one owner for the wave.
3. **The service card layout** — must live in `src/app/`, not inside A's feature, or B ends up
   importing from a sibling feature, which the rules forbid.
4. **`packages/ui`** — both will need tabs, a dialog, toasts, drag-and-drop. That is a third
   owner's zone. Either batch the missing components at the start of the wave, or temporarily give
   one of the two write access to it.

## 12. Decisions taken, for the record

- Word add-in dropped for now; lawyers upload documents and the core extracts logic and variables.
- The canonical template is structured data. The uploaded file is provenance only.
- The field dictionary is platform-owned and canonical; templates reference field keys.
- Versions and archive are a tab on the service card, not a sidebar section.
- The service card is a layout route so its tabs can be separate features.
- Both one-off purchase and subscription. Prices in EUR.
- Staleness is tracked for both models; entitlement decides what happens next.
- The event log is foundation work, not a later feature.

## 13. Open questions

**Blocking the split of work into issues**

1. **Condition editor (ADM-16): visual builder or a text expression with field autocomplete?** The
   second is several times cheaper and enough for a first version. This decides whether B fits
   inside their half of the wave.
2. **Who corrects an extraction — a human in an editor, or the AI on request with the patch
   confirmed by a human?** This decides whether ADM-15 is a full editor or a review surface.
3. **Does `packages/ui` get a temporary second owner for this wave?** Item 4 above.

**Blocking schema design**

4. **What counts as "the law changed"?** Who marks it, and does it trigger automatic re-issue or a
   notification only?
5. **Does a one-off purchase cover one document or a package?** This shapes the entitlement record.
6. **Is a subscription tied to specific services or to the platform as a whole?**
7. **Does an admin see clients' personal data, or only depersonalized orders?** This is an RLS
   question, not a UI one.
8. **How long do uploaded source documents and run outputs live?** Retention has to be set before
   the first upload, not after.
9. **Delivery format to the client — .docx, .pdf, or both?**

**Blocking wave planning**

10. **Which mode does the first service launch in?** If it is not `template` + `auto`, the
    per-order review queue moves from "deferred" into the first waves, because ADR-0005 requires a
    lawyer in the loop for the other two modes.
11. **Invitations or self-registration?** ADM-34 either exists or does not.
12. **Deactivation: soft disable or account deletion?**
13. **Is a service assigned to exactly one accountable lawyer, or to several participants?**

**Already answered, listed so they stop being reopened**

- One-off versus subscription — both (§8).
- Currency — EUR.
- First-wave statistics — about runs, not orders (§4.7).
- Source of truth for a template — structured data, not the file (§12).
