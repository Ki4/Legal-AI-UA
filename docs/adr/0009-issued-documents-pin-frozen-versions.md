# ADR-0009: An issued document pins a frozen version

- Status: accepted
- Date: 2026-08-04

## Context

VISION promises that a generated document carries a trace of what produced it and why, and that a
client can inspect what their document is built from. The commercial model adds a second promise:
a document stays valid until the law it rests on changes, which means the platform must be able to
say, for a document delivered months ago, exactly which template and which legal provisions
produced it.

Both promises fail the same way. If a document records "generated from service X" and service X is
edited afterwards, the record describes something that no longer exists. Nobody notices, because
nothing breaks — the row still resolves, it just resolves to different content than it did at
delivery. Two years later, in the one conversation where the record matters, it is quietly wrong.

The naive fix — snapshotting the whole template into every issued document — makes every delivered
document an independent copy, so a correction has to be applied to each one, and the connection
between a document and the template it came from is lost.

## Decision

An issued document references a **specific template version and service version by id**, never a
current-version pointer, and a **published version is frozen**: its content cannot change after
publication.

The two halves are one decision. Pinning without freezing records an id whose meaning drifts;
freezing without pinning leaves nothing to point at. Neither is useful alone.

Concretely:

- One version of a service is live at a time. Publishing a version archives its predecessor.
- A published or archived version's content is immutable. Lifecycle columns — status, publication
  stamps — may still move, which is how publish and archive work; everything that defines the
  document is fixed.
- Changing a live service is not an operation that exists. There is only issuing a new version.
- The freeze is enforced by database triggers, not only by row-level security, because
  `service_role` bypasses RLS (ADR-0004) and would otherwise be able to rewrite published content.
  It also makes a violation loud: a row filtered out by an RLS `USING` clause is not an error, it
  is an update that matches nothing, and a client that does not check the affected row count will
  report success.

Around that pin, an issued document carries a **passport**: the answers as given, the trace as it
stood at delivery, a hash of the delivered file, who reviewed and approved it, which consent
revisions the client accepted, when and how it was delivered, and the chain of any re-issues.

## Consequences

- The provenance question — what produced this document — has an answer that stays true, which is
  what makes both the anatomy view and the freshness promise defensible rather than merely claimed.
- The reverse index the subscription model needs (law article → blocks → template versions → issued
  documents) is possible because the middle of that chain is stable.
- Correcting a published template requires publishing a new version. This is more ceremony than
  editing in place, and it is the point: the ceremony is what keeps delivered documents explicable.
- Re-issuing a document after a law change produces a new version for the client and leaves the
  previous passport intact. A client's document therefore has versions of its own.
- Storage grows with versions rather than being overwritten. At this domain's volumes that is not
  a real cost, and it is the direct price of being able to answer the provenance question.
- Any UI that writes to a version must check the affected row count rather than assume success —
  see the RLS note above. This applies to every screen in the console that edits template content.

See `docs/specs/admin-console.md` §5.3, §5.4 for the passport contents and §4.3 for the lifecycle
screens.
