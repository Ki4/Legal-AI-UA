# ADR-0023: One parser per source, and zakon.rada.gov.ua is the one we have proved

- Status: accepted
- Date: 2026-08-30

## Context

ADR-0011 decided that the platform watches known articles itself rather than buying a publication
feed, and it decided that **partly because we did not yet know the shape of the problem** — building
the watcher first is how that knowledge is acquired, and it leaves a reference implementation to
evaluate a future supplier against. ADR-0020 then put the fetcher in a Supabase Edge Function and the
shared normalization in `packages/law-refs`.

Neither ADR could say what reading an act actually involves, because at the time nobody had read
one. `docs/specs/admin-console.md` §9.15 laid out four safety conditions against a parser that fails
silently, and §9.2 described `canonical_url` as "the 'whatever is currently in force' pointer — this
is what gets fetched". That sentence was written from the outside.

On 2026-08-30 we fetched real pages. Two things were not what the spec assumed, and both change the
design rather than the wording.

**The page our register points at contains no article text.** `https://zakon.rada.gov.ua/laws/show/2947-14`
is a JavaScript shell: 34 KB of site chrome, the act's title, its status, its redaction date, and not
one article. A fetcher built to §9.2's literal instruction — fetch `canonical_url`, extract the
article — would have extracted nothing from every norm on the platform. Under §9.15 condition 2 that
is at least loud: an empty extraction is a failure, so the result would have been every norm
`unreachable` rather than every norm silently green. The condition works. It would still have been a
day spent discovering it, and the discovery would have arrived after the schema was built around the
assumption.

**The text lives at `/print`**, 547 KB of server-rendered HTML, with articles opened by
`<span class=rvts9>Стаття N.</span>` and section headings distinguished by a different class.

A third thing was not a surprise but is worth recording: `curl` with its default User-Agent is
answered **403**, and the site intermittently drops a TLS handshake. Both are ordinary and both look
like an outage if nobody wrote them down.

## Decision

**Article extraction is per source, in a module named for the source.** `packages/law-refs/src/rada.ts`
knows `span.rvts9`, `span.dat0`, and that the text is at a different URL from the one a lawyer pastes.
None of that is a fact about legislation; all of it is a fact about one publisher's templates. **A
second source gets a second module, not a parameter added to this one.**

**`canonical_url` keeps its meaning and the fetcher derives the rest.** The register still stores what
§9.2 says it stores — the pointer a lawyer would recognise, in force rather than pinned. `printUrl()`
turns it into the URL that carries text. The alternative, storing the print URL, would have put a
publisher's implementation detail into a column two other runtimes read and a lawyer inspects.

**The shell page becomes §9.7's cheap probe.** §9.7 asks for a light request that decides whether the
expensive one is needed, and until now "light" meant an `ETag` nobody had checked. The shell is 34 KB
and carries `<span class="dat0">` — the redaction date, which moves only when the act is amended. The
547 KB fetch happens when that date moves and not otherwise. This is the two-tier design of §9.7
becoming concrete, and it is better than the `ETag` it replaces because it is a statement by the
publisher about the document rather than a property of an HTTP response.

The tier stays **act-level**, so an amendment to any article of a code triggers the expensive fetch
for every watched article of that code. That is the right cost: the alternative is missing an
amendment, and §9.4 already fixed the article as the unit for what a _lawyer_ is told, which is the
part that matters.

**The assertions of §9.15 condition 1 are sharpened by what we found**, and the sharpening is in the
spec as well as the code:

- A heading being **present** proves the parser read _an_ article. It does not prove it read _the_
  article. §9.13 already names renumbering as something that happens, so a parser satisfied by
  presence would follow the neighbouring provision forever and report perfect stability. The
  assertion is that the heading names the article that was asked for.
- A **redirect is not a failed fetch.** Acts get consolidated and rada moves them, so the page that
  answers may honestly belong to a different act. The final URL is re-normalized through the same
  `normalizeLawLink` the entry form uses.

**Fixtures are real pages, and the tests read them.** `packages/law-refs/fixtures/` holds bytes off
the live site with their provenance and refresh commands. Inventing them would have preserved exactly
the ignorance ADR-0011 set out to remove: a hand-written fixture proves a parser can read what its
author imagined.

## Consequences

- **The parse is proved, not asserted.** Twenty scenarios run against the saved pages: every article
  in the excerpt, the boundary where one ends and the next begins, the last article of a document
  with no heading after it, the inline `{...}` amendment footnote §9.7 decided to keep, the site's own
  furniture staying out, entity decoding, and each refusal in condition 1 separately.
- **One defect was caught by doing it this way, in the first run.** The blank-text assertion measured
  the whole slice, and since the heading is deliberately part of the returned text, it could never
  see an empty string — an assertion that cannot fail, which is the same as no assertion, in the one
  module written entirely to stop that. It now measures the text after the heading. This is condition
  3 doing its job on our own code rather than the publisher's.
- **A second source is a known quantity now rather than a hope.** What a new module must supply is
  exactly: find the text, extract one article, read the redaction date, and answer each of the eight
  `ProbeFailure` values. Everything after that — reduction, fingerprinting, what a probe means, what a
  triage decision obliges — is source-independent and already tested.
- **Non-HTML sources will not fit this shape at all, and that is expected.** A register offering a
  JSON API, a PDF-only publisher, a court-practice database: each would supply the same four answers
  by wholly different means, and the value of drawing the boundary here is that none of them needs to
  touch `probe.ts` or `triage.ts` to do it. If a later source shares nothing with this one but the
  interface, the interface was the right thing to have.
- **The fixtures will go stale, and that is a maintenance obligation rather than a defect.** They
  carry a redaction date and real legislative text, both of which move. A refresh that leaves the
  assertions green without anybody re-reading them has turned a fixture into wallpaper — the note is
  in `fixtures/README.md` where whoever refreshes them will be standing.
- **Revisit the buy-versus-build question with evidence now.** ADR-0011 deferred a commercial feed
  because we could not specify what we would be buying. We can now: one source, two page shapes, an
  act-level date as a change signal, and article extraction that is a hundred lines. That is a small
  enough maintenance surface that buying is not obviously better — and a concrete enough description
  to put to a supplier.

See `docs/specs/admin-console.md` §9.7 and §9.15 for the mechanism this serves, ADR-0011 for why we
build it at all, and ADR-0020 for where it runs.
