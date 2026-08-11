# Admin console — screens, metadata and audit

- Status: draft for discussion
- Date: 2026-08-04
- Audience: the two developers building the console, plus the core owner for the zone boundary

This is one document on purpose: the screen map, the user stories, the metadata model behind them,
and the backlog all constrain each other, and reading them apart is how they drift.

The architectural decisions recorded here have their own ADRs, which are the durable record; this
document is the plan of work built on top of them.

| ADR                                                                       | Covers                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| [ADR-0008](../adr/0008-templates-from-uploaded-documents.md)              | Uploads and extraction instead of a Word add-in (§5.1) |
| [ADR-0009](../adr/0009-issued-documents-pin-frozen-versions.md)           | Version pinning, freezing, the passport (§5.3, §5.4)   |
| [ADR-0010](../adr/0010-append-only-audit-with-pseudonymous-subjects.md)   | The audit model (§6, §7)                               |
| [ADR-0011](../adr/0011-monitoring-legislative-change.md)                  | Legislative change monitoring (§9)                     |
| [ADR-0013](../adr/0013-conversational-intake-transcript-is-provenance.md) | Chat intake, answer provenance (§5.5, §7.2)            |
| [ADR-0014](../adr/0014-client-data-access-follows-assignment.md)          | Who may read client data (§7.2, §7.3)                  |

## 1. Assumptions

Everything below is written as if **document generation and extraction already work**. They are
the core owner's zone (ADR-0004, ADR-0008) and the console is built around them, not with them.
Where the console needs the core, it needs it through the Edge Function gateway and nowhere else.

Two frontend developers work on this in parallel. Section 12 is the split.

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
/                          lawyer's cabinet: calendar and signals awaiting triage
/services                  service list
/services/:id              service card → overview
/services/:id/versions     versions, with archive behind a filter
/services/:id/fields       questionnaire: the variable dictionary
/services/:id/template     template: blocks and branching
/services/:id/runs         test runs and their history
/services/:id/stats        per-service statistics
/services/:id/history      who changed what
/services/:id/law          the norms this service depends on
/law                       law reference register
/law/signals               triage queue for detected changes
/team                      team (admin only)
/account                   own profile
```

Three decisions are baked into this map.

**Versions and the archive are not a top-level section.** They are a tab on the service card, and
the archive is a filter on that tab. A separate "archive" entry in the sidebar creates a dead
section nobody visits.

**The service card is a layout route with an `<Outlet/>`.** Each tab is its own feature
contributing its own child route. This is not cosmetic — it is the precondition for two people
working in parallel. If the tabs are branches of one component, both developers edit the same file
every day. The layout itself lives in `src/app/`, not inside a feature, so that no feature imports
from a sibling (the rule in `apps/console/CLAUDE.md`).

**The index route stops being a redirect to `/services`.** A lawyer assigned to services has
recurring obligations with dates on them — upcoming effective dates, scheduled reviews, signals
waiting to be triaged (§9). Those need somewhere to live, and the first screen after login is where
a person looks for what is owed today.

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
- As the assigned lawyer, I create and edit a draft version of my own service, including its
  review mode, without waiting on an admin — but I cannot publish it, price it, or reassign it.

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

### 4.9 Service law dependencies — `/services/:id/law`

The norms this service rests on: act, article, what it is relied on for, citation state (§9.11),
tracking interval, when it was last successfully checked.

- As a lawyer, I add a law reference by pasting a link and naming the article, and the system shows
  me the fetched text so I can confirm it is the norm I meant.
- As a lawyer, I write one line about what the block relies on, so whoever reads the diff in six
  months knows whether it matters.
- As a lawyer, I mark a reference as covering a whole act when that is genuinely the dependency,
  and I record why.
- As a lawyer, I change the tracking interval for a norm away from the recommended default, and I
  record the reason.
- As a lawyer, I cannot set an interval that would break the detection window promised to clients.
- As a lawyer, I see one honest freshness figure for the service, rolled up from its references.

### 4.10 Lawyer's cabinet — `/`

Calendar and obligations: upcoming effective dates, scheduled service reviews, signals awaiting
triage, references that have gone unreachable.

- As a lawyer, the first screen after login tells me what is owed today, not a service list.
- As a lawyer, I see a change that takes effect next month before it does, so I can prepare the new
  template version instead of catching up afterwards.
- As a lawyer, I see when a service of mine is next due for its scheduled full review.

### 4.11 Law register — `/law`

Act, article, link, tracked revision fingerprint, verification date, tracking interval, dependent
services. A "needs rechecking" report.

- As a lawyer, I record that I verified an article, so its citations stay trustworthy.
- As a lawyer, I see which articles have not been rechecked in too long.
- As a lawyer, I see which templates and which issued documents depend on an article (see §8.2).
- As a lawyer, I see a norm once, with every service that depends on it listed against it.

### 4.12 Signal triage — `/law/signals`

Detected changes waiting for a decision, with the diff.

- As a lawyer, I see what changed in the text, not just that something did.
- As a lawyer, I mark a change as not affecting the document in one click, and the reference is
  re-fingerprinted.
- As a lawyer, I mark a change as affecting the document, and the work it creates is visible: which
  templates, which services, which issued documents.
- As a lawyer, I defer a signal to the date the change takes effect.
- As an admin, I see signals nobody has triaged for too long.
- As an admin, a reference that could not be checked is as loud as one that changed.

### 4.13 Team — `/team`, admin only

- As an admin, I deactivate a lawyer to close access without erasing their history.
- As an admin, I change the role of an already-approved user.

### 4.14 Account — `/account`

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

### 5.5 Where an answer comes from

The client's channel is a chat bot, not a form (ADR-0013). The field dictionary is unchanged by
that — it stays canonical and channel-independent — but an answer stops being self-evident.

| Artifact         | What it is                            | Read by generation  |
| ---------------- | ------------------------------------- | ------------------- |
| Transcript       | Raw provenance, personal data, opaque | Never               |
| Extracted answer | Field key + value + confidence        | Only once confirmed |
| Confirmed answer | What the client is held to have said  | Yes                 |

Three rules follow, and they mirror the authoring side exactly (ADR-0008): an artifact a human
produced, an extraction over it, canonical structured data as the only thing downstream reads.

- An answer that cannot be traced to a field key does not enter generation.
- An extracted answer carries channel, source turn and confidence, and is `ai_generated` trust
  until a human confirms it. Unconfirmed answers do not feed generation.
- The passport's answer snapshot (§5.3) records provenance per answer, not only values.

The field dictionary (§4.4) gains one attribute for this: a special-category marker with its own
Art. 9(2) basis, because that is a different statement from an Art. 6(1) basis and one column
cannot hold both.

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
this; §7.1 is why it becomes load-bearing rather than merely good hygiene.

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

### 7.2 Retention schedule

Retention has to be set before the first upload and the first conversation, not after — a clock
cannot be applied retroactively to data already held. These are the platform defaults; a field's
own retention (§7, §4.4) may be shorter, never longer.

| Artifact                                        | Retention                                     | Why that number                                                                 |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Chat transcript                                 | 90 days after delivery; 30 if order abandoned | Enough to settle "I told you X", not enough to become a standing liability      |
| Uploaded precedent, depersonalisation confirmed | Life of the template version + 1 year         | Needed for re-extraction; firm work product, not client data                    |
| Uploaded precedent, not yet confirmed           | Transcript clock                              | Until a human confirms, assume it carries personal data                         |
| Test run outputs                                | 90 days, or last N per service                | Fixture data, no real client in it                                              |
| Issued document + passport                      | 7 years from delivery, then anonymised        | Limitation period for a claim; the passport must stay reconstructible that long |
| Action log                                      | 7 years                                       | Must outlive the document it describes; pseudonymous, so it survives erasure    |
| Access log                                      | 1 year                                        | Order-of-magnitude larger volume (§6.2); closes what ADR-0010 left open         |
| Profile after account deletion                  | 30 days grace, then anonymised                | Recovery window, then the anonymisation route of §7                             |

**The subtlety that will otherwise be found by a retention job.** A field's retention governs the
client's live record — not the frozen snapshot inside a passport. The passport is pinned and
immutable (ADR-0009) and keeps its own 7-year clock. A retention job that treats the two alike
deletes the evidence the platform is built to preserve.

Erasure runs on two mechanisms, not one (ADR-0013): the pseudonym mapping is destroyed, and
transcripts are hard-deleted. Either alone leaves personal data standing.

### 7.3 Who may read client data

Settled in ADR-0014. **Role governs platform capability; assignment governs case data.**

| Who                    | Sees                                                     |
| ---------------------- | -------------------------------------------------------- |
| Assigned lawyer        | Client data for their matters, on Art. 6(1)(b)           |
| Admin                  | Depersonalised by default — administration is not a case |
| Admin with break-glass | Named client data, reason recorded, time-boxed, notified |

Consent is not the gate for the assigned lawyer: refusing it would cost the client the service,
which under Art. 7(4) means it was never freely given. Consent's real job is secondary use —
precedent reuse, second-opinion review, training data — where a client can say no and still receive
their document.

Two consequences for the screens: client-bearing views are built depersonalised-first, and a
document is itself personal data, so "show the document but not the client's data" is not a state
the UI can offer.

## 8. Commercial model

Decided: **both one-off purchase and subscription.**

- One-off — a specific document or package, promised valid until the law changes.
- Annual subscription — documents kept up to date, plus additional features.

**Prices are in UAH.** The platform serves Ukraine and bills in hryvnia; the schema carries
integer minor units plus a currency code, so this is a data decision rather than a structural one.

The figures discussed were €130 one-off and €40/month, which convert to roughly ₴5,500 and ₴1,700
at recent rates. **Those hryvnia numbers are a conversion, not a decision** — they are recorded so
the order of magnitude is not lost, and the actual price list is open (§14). Renaming the currency
without restating the amounts would have divided the price by about forty.

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

### 8.6 What an entitlement records

Both purchase shapes are settled, and they converge on one relation rather than two systems.

- **One-off** covers a **set** of services, one or many. A "package" is an entitlement with several
  covered services, not a separate kind of thing.
- **Subscription is to the platform**, and the plan decides coverage: `plans` and the services each
  plan covers.

So both resolve to **entitlement → covered services**, which is what §8.3 predicted: one staleness
mechanism, with the entitlement deciding whether a client gets the refreshed document or a
notification and an offer.

**Price is a row per currency on a version, not a column pair.** UAH is what we sell in; EUR is
plausible later. A published version is frozen (ADR-0009), so a currency that arrives after
publication could not be added without breaking the freeze — and the freeze trigger must therefore
cover the price rows as well as the version. The amounts themselves are still open (§14).

## 9. Law monitoring

§8 sells a promise about legislation. This section is the machinery that keeps it.

### 9.1 The division of labour

Two signals, caught in completely different ways. Conflating them produces an RSS reader everyone
mistakes for compliance coverage.

| Signal                                                           | Caught by | Owner               |
| ---------------------------------------------------------------- | --------- | ------------------- |
| A tracked article's text changed                                 | Machine   | Platform            |
| A new amending act was published                                 | Machine   | Platform            |
| Court practice, ministry clarifications, draft laws, sector news | Human     | The assigned lawyer |

Every service has at least one assigned lawyer, and watching news and pending legislation is
their job, not the platform's. The platform automates only what has an official source and a
formal structure.

### 9.2 A pasted link is not what we track

The lawyer's input is a URL. That is the right thing to ask a human for and the wrong thing to
watch, for three reasons.

**The pinned-redaction trap.** A link to an act can point at the current text or at a fixed
historical revision. A lawyer will often copy the second, because that is the revision they read.
Watching it will _never_ fire — that text is immutable by definition. The service stays green
forever and nobody can explain why.

So a link is **normalized on entry** into the triple that is actually tracked: source, act
identifier, article, plus a pointer meaning "whatever is currently in force". The original URL is
kept for display only.

**Granularity.** A link to a whole code fires on every amendment to any of its articles. See §9.4.

**Link rot.** Acts get consolidated and URLs move. A failed fetch is its own state — never
"no change".

### 9.3 Watch once, depend many times

Ten services will cite the same article. It is watched **once**, in a shared register, and the
dependency "this service relies on this norm" hangs off it separately.

Watching per service would mean ten fetches of one text, ten possibly-diverging states for the
same article, and no way to say which is right.

The fan-out — norm → blocks → template versions → issued documents → clients — is derived from
the dependency, and it is the same reverse index §8.1 requires.

### 9.4 Article level is the norm, act level is a marked exception

A code has hundreds of articles; a template rests on a handful. Tracking the code as a whole fires
an alarm on every amendment anywhere in it, nearly all irrelevant. The lawyer stops opening the
alerts within a month — and that failure is invisible, because everything still looks like it is
working.

So: **the article is required by default.** Act-level tracking is allowed, but only as an explicit,
recorded choice with a reason — sometimes the dependency really is on a whole new act, and forcing
an invented article number is worse than an honest "whole act, noise expected" flag.

### 9.5 Guide: adding a law reference

Written for the lawyer entering it. The in-product version is Ukrainian and lives in
`packages/i18n` as content; this is the specification of what it must say.

1. **Link to the version currently in force**, not to a fixed historical revision. If you were
   reading a specific revision, that is fine — paste it anyway, the system will resolve it.
2. **Name the article.** If the block depends on a specific part or point of it, say which.
3. **One citation per norm the block actually relies on.** Do not cite for context or for weight.
4. **Several dependencies mean several citations**, not one broad one.
5. **If the dependency really is the whole act**, mark it as act-level and accept the extra noise.
6. **Write one line about what you relied on** — "grounds for dissolution of marriage". When a
   diff arrives in six months, this sentence is what tells the reader whether the change matters.
7. **Confirm the text the system shows you.** After you save, the article is fetched and displayed
   back. Check it is the norm you meant.

### 9.6 Designing for a wrong citation

A lawyer will mistype an article number, cite a repealed provision, or pick the wrong act. The
system assumes this rather than trusting the input.

- **Validate on entry.** Fetch the cited article immediately and show it back. A number that does
  not exist in that act is rejected at the cheapest possible moment.
- **Confirm, don't type.** Where extraction proposes citations from the template text, the lawyer
  confirms a candidate instead of typing an identifier.
- **A citation can be marked wrong and replaced** without losing the history of what it used to be.
- **The scheduled full review** (§9.8) is the backstop for what still slips through.

### 9.7 What a check does

Two tiers, which is what makes a frequent cadence affordable.

- **Cheap probe** — compare the published revision date, `ETag` or `Last-Modified`. One light
  request, no parsing.
- **Expensive comparison** — only when the probe moved: fetch, extract the article, normalize
  (whitespace, markup, numbering artifacts), hash, compare against the stored fingerprint, produce
  a diff.

What is stored per citation is a **fingerprint of the revision**, not merely a date. A date says
only that somebody looked; a fingerprint says whether what they looked at is still the same thing.
That is the difference between "worth rechecking" and "this definitively changed".

### 9.8 Cadence

The interval is configurable per norm, with a recommended default the platform proposes and a
person may change. The rationale for a non-default value is recorded.

| Scope                                                 | Recommended default      |
| ----------------------------------------------------- | ------------------------ |
| Norms behind at least one published service           | Daily probe              |
| Norms used only by drafts                             | Weekly probe             |
| Full human review of a service, regardless of signals | Quarterly, on by default |

New acts amending a tracked act are deliberately absent from this table — see §9.14.

Three rules around this:

- **Configuration must not be able to break the commercial promise.** For a norm behind a published
  service, the interval cannot be set longer than the detection window §8 commits to. Same shape as
  the ADR-0005 constraint: the model refuses configurations that contradict a promise.
- **No adaptive frequency.** "Check volatile acts more often" is superficially clever and wrong
  here: an act untouched for three years and then amended is precisely the dangerous case, and
  adaptive cadence is asleep for it.
- **Scale is not the constraint.** A few hundred articles probed daily is a few hundred light
  requests. The interval is chosen from what was promised, not from what is cheap.

### 9.9 Much of the future is already knowable

An amending act almost always states the date it takes effect, often months out. That is not a
polling problem — it is a **calendar entry**.

When such an act is seen, the system creates a **scheduled signal**: "this article changes on
date X". It fires on the date, and it is visible before it.

This is the largest practical win in the whole section: the lawyer prepares the new template
version _before_ the law takes effect, instead of catching up afterwards. For a paid freshness
promise that is the difference between having reacted and having been ready.

The lawyer's cabinet therefore carries a **calendar with reminders**: upcoming effective dates,
scheduled reviews, signals awaiting triage.

### 9.10 Green must mean checked

"No difference found" and "no check completed" are different states and must never render alike.

If a norm has not been _successfully_ checked for several times its interval, that is an alarm in
its own right, equal in weight to a detected change. Without this, a broken fetcher looks exactly
like perfect order, and the first to notice is a client.

### 9.11 A citation has more than two states

| State            | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| verified         | Fingerprint matches the last confirmed revision            |
| drifted          | Fingerprint changed, nobody has looked yet                 |
| under review     | A lawyer is assessing whether the change matters           |
| impact confirmed | It changes the document — a new template version is needed |
| no impact        | Changed but irrelevant; re-fingerprint and continue        |
| scheduled        | A known change lands on a future date (§9.9)               |
| stale by time    | Nothing detected, but verification is older than policy    |
| unreachable      | Fetch failing — see §9.10                                  |

The **no impact** path carries more weight than it looks. Most amendments to a large code do not
touch the specific provision a template rests on — renumbering, editorial fixes, changes to a
neighbouring article. If every drift forced a template update the system would become a source of
false alarms, and lawyers would stop reading it. Marking "no impact" must be one click, and the
decision is recorded with its author: it is a legal judgement, not a housekeeping flag.

### 9.12 Where AI helps here

Classifying a diff as editorial or substantive, and pointing out whether it touches the cited
provision, is a good use of the core: the lawyer still decides, but reads a summary instead of a
raw diff. Not first-wave work, and it changes none of the mechanics above.

### 9.13 Honest limits

- An article-level diff will not see meaning change because a definition elsewhere moved, or
  because of transitional provisions. Cross-references stay a human matter; the system's job is to
  record a dependency once discovered, not to infer it.
- A new act nobody is tracking is not detectable by machine at all. That is exactly the layer the
  assigned lawyer covers.
- Renumbering and editorial edits will produce meaningless diffs. Mitigated by aggressive
  normalization and by "no impact" being one click.

### 9.14 We build the fetcher, and we do not build the feed

Two capabilities were being discussed as one. They are not the same size and they do not get the
same answer.

**Watching known articles** — take a list of citations we already hold, check whether the text
moved. Bounded, well understood, and small at our scale: one source, a few dozen articles.
**We build this.**

**Ingesting the publication stream** — take every newly published act and work out which of ours
it amends. A different problem entirely, because it reasons about acts that are not in our list.
**We neither build nor buy this for now.** New acts are the assigned lawyer's manual
responsibility (§9.1), so dropping it leaves no gap that was not already covered by a human.

Buying a commercial feed was considered and rejected _for now_, on a deliberate ground: we do not
yet know enough about the problem to specify what we would be buying — what coverage, what
granularity, what latency, in what format. Building the watcher first is how that knowledge is
acquired, and it leaves a working reference implementation to evaluate any future supplier
against. Revisit when the number of tracked norms, or the number of sources, makes maintenance
real.

### 9.15 What makes a home-grown fetcher safe

The objection to building rather than buying was never that parsers are bad. It was that a broken
parser fails **silently**: markup changes, extraction returns nothing, no differences are reported,
and everything looks healthy until a client notices. That objection is answered in full once
**"I don't know" is a first-class outcome**, alongside "changed" and "unchanged".

Four conditions, in order of how much they matter:

1. **The parser asserts what it expects to find.** Article heading present, text non-empty,
   revision date parseable. Any assertion failing yields `unreachable` (§9.11) — never
   "no change". This one carries the argument; the rest are support.
2. **Non-empty is an invariant.** An empty or implausibly short extraction is a failure, always.
   This is exactly what broken markup looks like: not an error, silence.
3. **Fixtures in CI.** A handful of saved pages with known expected output. These catch our own
   regressions when the parser is refactored — they cannot catch the source changing, which is
   what condition 1 is for.
4. **Periodic human spot-check.** Once a quarter a lawyer verifies two or three norms by hand
   against the source. Cheap, and the only thing that catches a systematic bias the automation
   cannot see in itself.

### 9.16 Response times

Two different obligations, on two different clocks. Merging them produces a target that is missed
routinely and therefore means nothing.

| Obligation      | Deadline                                    |
| --------------- | ------------------------------------------- |
| Triage a signal | One business day from notification          |
| Fix the impact  | A date set by the lawyer at triage, tracked |

Triage is small work — open it, read the diff, decide: no impact, impact, or defer to the
effective date. One business day is achievable. Remediation is not one day: rewriting blocks,
running fixtures, publishing a version and re-issuing documents can take a week. The severity that
sets the deadline can only be judged by the person who has read the diff, so it is set at triage
rather than fixed in policy — a law taking effect in three months and a law that made yesterday's
delivered document wrong are not the same urgency.

Consequences that follow directly from naming a number:

- **One business day means business days.** A signal arriving Friday evening, with one lawyer on
  the service and no cover, waits until Monday. This turns the cover question (§14) from
  theoretical into operational.
- **The service's state while a signal is untriaged.** Proposed: an untriaged signal leaves the
  service on sale but visibly flagged; a **confirmed impact on a published service pauses it**
  until a new version ships. That makes "impact confirmed" a consequential decision, which is
  right. It costs revenue; selling a document we know to be wrong costs more.
- **What the client is told, and when.** Proposed: told immediately, with the note that an update
  is being prepared. Waiting until the fix is friendlier and leaves a window in which someone acts
  on a document we already know is wrong. Open (§14) — this one is a product call, not an
  engineering one.

## 10. Backlog

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

### Intake, access and entitlements

| ID     | Task                                                         | Depends      | Size |
| ------ | ------------------------------------------------------------ | ------------ | ---- |
| ADM-54 | Transcript store, extraction to answers, confirmation (§5.5) | ADM-18       | L    |
| ADM-55 | Retention jobs and the two erasure paths (§7.2)              | ADM-1, ADM-6 | M    |
| ADM-56 | Break-glass grants, expiry and client notification (§7.3)    | ADM-6        | M    |
| ADM-57 | Entitlements: one-off sets and platform plans (§8.6)         | ADM-1        | M    |

ADM-55 sits next to ADM-6 for the same reason: a clock that starts late is not a retention policy,
and the data it should have covered is already held.

### Law references

| ID     | Task                                       | Depends        | Size |
| ------ | ------------------------------------------ | -------------- | ---- |
| ADM-21 | Article register, watched once (§9.3)      | ADM-1          | M    |
| ADM-22 | Link articles to blocks                    | ADM-14, ADM-21 | S    |
| ADM-23 | "Needs rechecking" report                  | ADM-21         | S    |
| ADM-24 | Impact index: article → affected documents | ADM-21, ADM-30 | M    |

### Law monitoring (§9)

| ID     | Task                                                       | Depends        | Size |
| ------ | ---------------------------------------------------------- | -------------- | ---- |
| ADM-41 | Link normalization and entry-time validation (§9.2, §9.6)  | ADM-21         | M    |
| ADM-42 | Citation entry UI with fetched-text confirmation           | ADM-41         | M    |
| ADM-43 | Fingerprint store and text normalization (§9.7)            | ADM-21         | M    |
| ADM-44 | Probe scheduler with per-norm interval and floor (§9.8)    | ADM-43         | M    |
| ADM-45 | Diff production and signal creation                        | ADM-43         | M    |
| ADM-46 | Signal triage queue and citation states (§9.11)            | ADM-45         | M    |
| ADM-47 | Effective-date calendar and scheduled signals (§9.9)       | ADM-45         | M    |
| ADM-48 | Lawyer's cabinet: calendar, obligations, overdue signals   | ADM-46, ADM-47 | M    |
| ADM-49 | Health: unreachable norms and stale-check alarms (§9.10)   | ADM-44         | S    |
| ADM-50 | Fetcher safety: assertions, fixtures, spot-check (§9.15)   | ADM-43         | M    |
| ADM-51 | Scheduled full service review, on by default (§9.8)        | ADM-6          | S    |
| ADM-52 | Triage SLA timers and overdue escalation (§9.16)           | ADM-46         | S    |
| ADM-53 | Auto-pause a published service on confirmed impact (§9.16) | ADM-46, ADM-32 | S    |

Fetching, normalization and diffing belong to the core owner's zone; the console owns entry,
triage, the calendar and the health surfaces.

ADM-50 is not optional polish. It is what makes building the fetcher instead of buying a feed a
sound decision rather than a cheap one — without it the failure mode is silence (§9.15). It ships
with ADM-43, not after it.

Publication-feed ingestion is deliberately not in this table (§9.14).

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
operations; entitlements; bulk re-issue after a confirmed impact; notifications; payments and
payouts. These wait on `apps/web` and on real orders, not on an unanswered product question any
more.

**Consultation booking.** Human-in-the-loop today means a lawyer reviewing one document. The next
step is a client booking time with a lawyer directly — a scheduled consultation rather than a
review of an artifact. It needs the assigned-lawyer model (already here), availability, and a
calendar the client can see, so it sits naturally next to the lawyer's cabinet in §4.10 rather
than as a separate product. Not scoped yet; recorded so the cabinet is not designed in a way that
forecloses it.

## 11. Waves

**Wave 1 — foundation.** ADM-1…6. Until this stands, one developer has no data and the other has
no contract. ADM-33 and ADM-36 can run alongside: they depend on nothing and are a good way to warm
up against live Supabase.

**Wave 2 — the service exists as an entity.** Catalogue, upload and extraction, field dictionary.

**Wave 3 — the loop closes.** Template editing and the sandbox. This is where the console first
becomes useful to a lawyer.

**Wave 4 — around it.** Law references and monitoring, publication lifecycle, cross-cutting
concerns.

One ordering constraint inside wave 4: **citation entry comes before the watcher.** ADM-41 and
ADM-42 — normalized links, validated on entry — must land before ADM-44 starts probing on a
schedule. Watching a register full of un-normalized links reproduces the pinned-revision trap
(§9.2) at scale, and the symptom is silence, which nobody investigates.

ADM-51, the scheduled full review, is worth pulling earlier than the rest of the group: it needs
only the event log, and it is the backstop that covers for everything in §9 not being built yet.

## 12. Two developers in parallel

Split by vertical, not by layer. "One writes the API, the other the UI" produces continuous
blocking.

**Developer A — catalogue and lifecycle.** `features/services`, `features/service-detail` (layout
plus overview), `features/service-versions`, `features/service-stats`, `features/service-history`.
Publication, pause, archive, lawyer assignment.

**Developer B — service content.** `features/service-fields`, `features/service-template`,
`features/service-runs`. Upload, extraction status, block tree, condition editor, fixtures, runs,
trace.

The load is roughly even, but B carries more risk: the branching condition editor (ADM-16) is the
hardest item on the list. `/team` and `/account` go to whoever frees up first.

Law monitoring (§9) is a third vertical and does not fit inside either half. Its console surfaces —
citation entry, the triage queue, the cabinet calendar, the health screens — are a wave-4 track of
their own; the fetching, normalization and diffing behind them belong to the core owner. Do not
split it across A and B: it touches the service card, the law register and the index route at once,
which is exactly the shape that produces conflicts.

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

## 13. Decisions taken, for the record

- Word add-in dropped for now; lawyers upload documents and the core extracts logic and variables.
- The canonical template is structured data. The uploaded file is provenance only.
- The field dictionary is platform-owned and canonical; templates reference field keys.
- Versions and archive are a tab on the service card, not a sidebar section.
- The service card is a layout route so its tabs can be separate features.
- Both one-off purchase and subscription. Prices in UAH, carried as integer minor units plus a
  currency code.
- Staleness is tracked for both models; entitlement decides what happens next.
- The event log is foundation work, not a later feature.
- Every service has at least one assigned lawyer. News, court practice and pending legislation are
  their manual responsibility; the platform automates only formally published acts (§9.1).
- A norm is watched once in a shared register; service dependencies hang off it (§9.3).
- A pasted link is normalized into act + article + "currently in force" before being tracked; the
  URL itself is kept only for display (§9.2).
- The article is required by default; act-level tracking is an explicit, justified exception
  (§9.4).
- The tracking interval is per norm, with a recommended default a person may override, and a floor
  that configuration cannot push past the promised detection window (§9.8).
- No adaptive frequency (§9.8).
- Scheduled full human review of a service is on by default (§9.8).
- Known future changes become calendar entries with reminders in the lawyer's cabinet, not
  something discovered after the fact (§9.9).
- The index route becomes the lawyer's cabinet rather than a redirect to `/services`.
- We build the article fetcher rather than buying a feed, and the safety conditions in §9.15 ship
  with it rather than after it.
- Publication-feed ingestion is neither built nor bought for now; new acts remain the assigned
  lawyer's manual responsibility (§9.14).
- A signal is triaged within one business day; the deadline for fixing a confirmed impact is set
  by the lawyer at triage (§9.16).
- The client's intake channel is a chat bot. The field dictionary stays canonical and
  channel-independent; the transcript is provenance and generation never reads it (§5.5).
- An answer extracted from a conversation is `ai_generated` trust and must be confirmed before it
  feeds generation (§5.5).
- Erasure runs on two mechanisms — destroy the pseudonym mapping, hard-delete transcripts (§7.2).
- Retention is set per artifact class before the first upload, not after (§7.2).
- Role governs platform capability; assignment governs case data. An admin is depersonalised by
  default and reaches named data only through a recorded, time-boxed break-glass grant (§7.3).
- Consent is not the gate for the assigned lawyer — it is the gate for secondary use (§7.3).
- Clients do not live in `profiles`; client identity is its own table and holds the pseudonym
  mapping (ADR-0014).
- A one-off purchase covers a set of services; a subscription is to the platform and its plan
  decides coverage. Both resolve to one entitlement → services relation (§8.6).
- Price is a row per currency on a version, and the freeze trigger covers it (§8.6).
- Inside the catalogue the split is commercial versus professional, not senior versus junior. An
  admin decides what is on sale, at what price, and when it is published; the assigned lawyer owns
  the draft of their own service, `review_mode` included, because they are the only person who can
  judge whether a document needs a lawyer in the loop (ADR-0005, §4.3).

## 14. Open questions

Questions keep their id when they are answered and move to the closed list below, so that a
reference to "Q9" written six months ago still points at the same question. Ids are never reused.

**Blocking the split of work into issues**

- **Q1. Condition editor (ADM-16): visual builder or a text expression with field autocomplete?**
  The second is several times cheaper and enough for a first version. This decides whether B fits
  inside their half of the wave.
- **Q2. Who corrects an extraction — a human in an editor, or the AI on request with the patch
  confirmed by a human?** This decides whether ADM-15 is a full editor or a review surface.
- **Q3. Does `packages/ui` get a temporary second owner for this wave?** Item 4 of §12.

**Blocking law monitoring (§9)**

- **Q4. What detection window do we promise clients?** A day, a week. Every interval in §9.8 is
  derived from this number, and the floor that configuration cannot cross is set by it. This is
  the first question to answer in this group — the rest depend on it.
- **Q5. Does a published service pause itself when an impact is confirmed?** §9.16 proposes yes.
  It costs revenue on a false positive and prevents selling a document we know to be wrong.
- **Q6. Is the client told as soon as an impact is confirmed, or only once the fix ships?** §9.16
  proposes immediately, with a note that an update is being prepared. A product call.
- **Q7. When a change has a known future effective date, do we tell affected clients in advance or
  on the day?** Advance notice is better product and more support load.
- **Q8. Does a confirmed impact trigger automatic re-issue, or a notification with a human
  deciding?** §9 stops at the signal; this decides what happens after "impact confirmed".

**Blocking schema design**

- **Q9. What are the actual hryvnia prices?** The currency and its shape are settled (§8, §8.6);
  the amounts are not. The euro figures discussed in §8 are a recorded conversion so the order of
  magnitude survives, not a decision.
- **Q14. Delivery format to the client — .docx, .pdf, or both?** Part of the passport (§5.3).

**Blocking wave planning**

- **Q15. Which mode does the first service launch in?** If it is not `template` + `auto`, the
  per-order review queue moves from "deferred" into the first waves, because ADR-0005 requires a
  lawyer in the loop for the other two modes.
- **Q16. Invitations or self-registration?** ADM-34 either exists or does not.
- **Q17. Deactivation: soft disable or account deletion?**
- **Q18. Who covers a service while its assigned lawyer is away?** Settled: at least one lawyer per
  service. Still open, and now operational rather than theoretical, because §9.16 commits to one
  business day: a signal arriving on Friday against a single unavailable lawyer breaches the SLA
  by Monday with nobody at fault.

**Already answered, listed so they stop being reopened**

- **Q10** — a one-off covers a set of services; a package is an entitlement with several, not a
  separate kind (§8.6).
- **Q11** — the subscription is to the platform, and the plan decides which services it covers
  (§8.6).
- **Q12** — an admin does not see client personal data by role. Assignment grants it; break-glass
  is the recorded exception (§7.3, ADR-0014).
- **Q13** — retention is fixed per artifact class in §7.2, transcripts included and shortest.

- One-off versus subscription — both (§8).
- Currency — UAH (§8). The amounts themselves are still open.
- First-wave statistics — about runs, not orders (§4.7).
- Source of truth for a template — structured data, not the file (§13).
- Who watches news and draft legislation — the assigned lawyer, manually (§9.1).
- Whether to make tracking intervals configurable — yes, per norm, with a recommended default and
  a floor (§9.8).
- Whether a norm is watched once or per service — once (§9.3).
- Whether adaptive frequency is worth it — no (§9.8).
- Whether scheduled full review is opt-in — no, it is on by default (§9.8).
- Buy a feed or build the fetcher — build, and revisit later with a working reference
  implementation to judge suppliers against (§9.14).
- Publication-feed ingestion — not built and not bought; new acts stay the lawyer's manual layer
  (§9.14).
- How long a lawyer has to triage a signal — one business day (§9.16).
- How long a lawyer has to fix a confirmed impact — a date set at triage, not a fixed policy
  number (§9.16).
