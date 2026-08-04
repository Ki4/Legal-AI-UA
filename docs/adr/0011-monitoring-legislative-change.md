# ADR-0011: Monitoring legislative change

- Status: accepted
- Date: 2026-08-04

## Context

The platform sells two things: a one-off document, promised valid until the law changes, and an
annual subscription whose value is that documents stay current. Both promises are claims about
legislation we did not write and do not control, so both require knowing when a tracked provision
moves.

A lawyer is assigned to every service and already watches news, court practice and pending
legislation. That layer is human by nature — it has no official source with a machine-readable
structure. What does have one is the published act: an identifier, an article, a revision with a
date. That part is automatable, and this ADR is about it.

The naive implementation — store the date a lawyer verified a citation, and remind them when it
gets old — does not detect anything. It records when somebody looked, not whether what they looked
at is still the same.

## Decision

**A pasted link is normalized before anything watches it.** The lawyer supplies a URL; the tracked
identity is the triple of source, act identifier and article, plus a pointer meaning "whatever is
currently in force". The URL is kept for display only.

This exists because of a specific failure: a link may address a fixed historical revision, and a
lawyer will often paste exactly that, because it is the revision they read. Watching it can never
fire — the text behind it is immutable by definition — and the affected service stays green
permanently with no visible cause.

**What is stored is a fingerprint of the revision, not a date.** A hash of the normalized article
text, so detection is mechanical: re-fetch, hash, compare. A date tells you when someone looked; a
fingerprint tells you whether it still holds.

**A norm is watched once**, in a shared register, with per-service dependencies hanging off it.
Watching per citing service would mean repeated fetches of one text and several diverging states
for the same article with no way to say which is right.

**The article is the default unit; act-level tracking is an explicit, justified exception.** A code
has hundreds of articles and a template rests on a handful. Tracking a whole code fires on every
amendment anywhere in it, and a lawyer who receives mostly irrelevant alerts stops reading them —
a failure that leaves every indicator green.

**Intervals are configurable per norm, with a recommended default and a floor.** Configuration must
not be able to break the commercial promise: for a norm behind a published service the interval
cannot exceed the promised detection window. Same shape as the ADR-0005 constraint — the model
refuses configurations that contradict a commitment. Adaptive frequency is rejected: an act
untouched for three years and then amended is precisely the dangerous case, and adaptive cadence is
asleep for it.

**Known future changes are calendar entries, not polling.** An amending act states when it takes
effect, often months ahead. Seeing one creates a scheduled signal that is visible before it fires,
so a lawyer prepares the new template version before the law takes effect rather than after.

**"No difference found" and "no check completed" are different states.** A norm not successfully
checked for several times its interval raises an alarm equal in weight to a detected change.

**We build the article watcher and we do not build the publication feed.** Watching known articles
is bounded — one source, a few dozen articles. Ingesting the publication stream reasons about acts
that are not in our list; it is a different problem and is neither built nor bought for now,
because the assigned lawyer already covers new acts. Buying a commercial feed was considered and
deferred on the ground that we cannot yet specify what we would be buying; building the watcher is
how that knowledge is acquired.

That last choice is only sound alongside its safety conditions, which ship with the fetcher rather
than after it: the parser asserts what it expects to find and yields "unreachable" when an
assertion fails; an empty extraction is a failure and never "unchanged"; saved pages in CI catch
our own regressions; a lawyer spot-checks a few norms by hand each quarter. The objection to
building was never that parsers are bad — it was that a broken one fails silently. These make
"I don't know" a first-class outcome.

**Two response clocks.** A signal is triaged within one business day; the deadline for fixing a
confirmed impact is set by the lawyer at triage. Only someone who has read the diff can judge
whether a change takes effect in three months or made yesterday's delivered document wrong.

## Consequences

- The reverse index from ADR-0009 becomes load-bearing rather than nice to have: a signal is only
  actionable if it fans out to affected templates, services and issued documents.
- The verification date on a law reference stops being hygiene and becomes the mechanism behind a
  paid promise.
- Both commercial models need the same machinery. A one-off buyer was also promised validity, so
  staleness is tracked identically; the entitlement record decides only what happens next — a
  subscriber receives the refreshed document, a one-off buyer receives a notification and an offer.
  One mechanism, not two systems.
- Notifications leave the deferred list. A freshness promise with no delivery channel is not a
  promise.
- Naming a response time creates an operational obligation: with one lawyer per service and no
  cover, a signal arriving on Friday breaches the one-business-day target by Monday with nobody at
  fault. Cover is an open question rather than a solved one.
- Known limits, accepted: an article-level diff will not catch meaning changing because a
  definition moved elsewhere or because of transitional provisions; a new act nobody tracks is not
  machine-detectable at all. Both are covered by the assigned lawyer and by the scheduled full
  review of each service, which runs on a quarterly default regardless of whether any signal fired.
- Revisit the build-versus-buy choice when the number of tracked norms or sources makes maintenance
  real. By then there is a working implementation to judge suppliers against, which is most of the
  argument for building first.

See `docs/specs/admin-console.md` §9 for the full mechanism and §4.9, §4.11, §4.12 for the screens.
