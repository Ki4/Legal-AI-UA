# Fixtures — real pages from zakon.rada.gov.ua

§9.15 condition 3: "a handful of saved pages with known expected output". These are those pages.
They catch **our own** regressions when the parser is refactored; they cannot catch the source
changing its markup, which is what the assertions of condition 1 are for. Keeping the two jobs apart
is the point of having both.

Every byte here came off the live site on **2026-08-30**. Nothing is hand-written, because a
hand-written fixture proves the parser can read what its author imagined and nothing else — and the
whole reason ADR-0011 chose to build rather than buy was that we did not yet know the shape of the
problem. Inventing the pages would have preserved exactly that ignorance.

## What each one is

| File                                    | Fetched from                                        | Why this one                                                                                                                    |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `zakon-rada-2947-14-shell.html`         | `https://zakon.rada.gov.ua/laws/show/2947-14`       | The page our register's `canonical_url` actually points at. Carries the redaction date and status — and no article text at all. |
| `zakon-rada-1404-19-shell.html`         | `https://zakon.rada.gov.ua/laws/show/1404-19`       | A second act, so that "the date lives in `span.dat0`" is a pattern rather than a coincidence.                                   |
| `zakon-rada-2947-14-print-excerpt.html` | `https://zakon.rada.gov.ua/laws/show/2947-14/print` | Where the text actually is. Articles 103–109 of the Family Code, including one carrying an inline amendment footnote.           |

## The excerpt is a slice, and here is exactly which

The full print page is 547 KB — a size that costs every checkout and every diff forever, to prove
nothing the slice does not. So the fixture is **two real byte ranges of that page, joined**, plus a
three-line close:

1. Everything from the first byte through the end of the page chrome, ending immediately before the
   first `<p class=rvps7>` of the document body. Real, and kept precisely because a parser must not
   mistake the site's own furniture for legislation.
2. The bytes from the `<p>` opening **Стаття 103** up to the `<p>` opening **Стаття 110**.
3. `</div></body></html>`, which is the only part of this file nobody fetched.

Article 109 therefore ends at the end of the document, which is not an artifact of the slicing — it
is the boundary case a parser has to get right for the last article of any act, and here it is free.

## Refreshing them

`curl` needs a browser `User-Agent`; the default one is answered with **403**. The site also refuses
occasional requests with a TLS handshake error, which is worth knowing before reading one as an
outage:

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

curl -sS -L --compressed -H "User-Agent: $UA" -H "Accept-Language: uk-UA,uk;q=0.9" \
  -o zakon-rada-2947-14-shell.html "https://zakon.rada.gov.ua/laws/show/2947-14"
```

The excerpt is cut from the freshly fetched print page by the two ranges above.

**A refreshed fixture is a change to the expected output, not only to the input.** These pages carry
a redaction date and real legislative text, both of which move; a refresh that keeps the assertions
green without anybody re-reading them has turned a fixture into wallpaper.

## How the tests read them, and why not with `node:fs`

`packages/law-refs` has no dependencies and no Node built-ins, so that Deno reads its source
unchanged (ADR-0020). Reaching for `node:fs` in a test would have cost `@types/node`, and that is a
worse trade than it looks: the compiler would stop objecting the day somebody reached for `node:fs`
in `src/` itself, which is the constraint keeping the console and the edge function agreeing about
what a norm is.

So the tests import the fixtures through Vite's `?raw`, which both Vitest and the console already
run. `src/fixtures.d.ts` is the whole cost. The parser itself takes an HTML string and knows nothing
about where it came from.
