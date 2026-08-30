// Reading an article out of a zakon.rada.gov.ua page (spec §9.15, ADR-0023).
//
// **Named for its source on purpose.** Everything below is a fact about one
// publisher's markup — `span.rvts9` opens an article, `span.dat0` holds the
// redaction date, the text lives at a different URL than the one a lawyer pastes
// — and none of it is a fact about legislation. A second source gets a second
// module, not a parameter added to this one; ADR-0023 records why that is the
// cheaper shape.
//
// **What the live site actually turned out to be**, because two of these were
// surprises and both changed the design:
//
//   1. **The page our register points at contains no text.** `/laws/show/2947-14`
//      is a JavaScript shell: 34 KB of chrome, the act's title, its status and
//      its redaction date, and not one article. Fetching `canonical_url` and
//      extracting from it — which is what §9.2 and the register's own column
//      comment describe — would have yielded an empty extraction for every norm
//      on the platform. The text is at `/print`, 547 KB of server-rendered HTML.
//   2. **That split is a gift rather than a nuisance.** §9.7 asks for a cheap
//      probe and an expensive comparison, and until now "cheap" meant an `ETag`
//      nobody had checked was stable. The shell is the cheap probe: 34 KB
//      carrying a redaction date that moves only when the act is amended. The
//      547 KB fetch happens when that date moves, and not otherwise.
//
// This module is pure — HTML in, result out — so the edge function owns every
// request and this owns every assertion.

import { normalizeArticle } from "./article.ts";
import type { ProbeFailure } from "./types.ts";

export type RadaExtraction = { ok: true; text: string } | { ok: false; reason: ProbeFailure };

export type RadaDate = { ok: true; date: string } | { ok: false; reason: ProbeFailure };

/**
 * The span class that opens an article, and the entire basis of the parse.
 *
 * Verified against the Family Code's print page: 294 occurrences, 286 of them
 * article headings. Sections and chapters use `rvts15`, so the marker really is
 * article-specific rather than "the styling of an important line".
 *
 * The attribute is unquoted in the served markup (`class=rvts9`), which is
 * valid HTML and would defeat a pattern written from how one would have written
 * it oneself. Quoting is accepted too, because a publisher tidying their
 * templates should not read as every article vanishing at once.
 */
const ARTICLE_HEADING = /<span\s+class=["']?rvts9["']?\s*>\s*Стаття\s+([^<]{1,24}?)\s*<\/span>/giu;

/** `<span class="dat0"><b>05.08.2026</b></span>` on the shell page. */
const REDACTION_DATE =
  /<span\s+class=["']?dat0["']?\s*>\s*<b>\s*(\d{2})\.(\d{2})\.(\d{4})\s*<\/b>/iu;

/** Block-level tags whose end is a line break in the text they contained. */
const BLOCK_BREAK = /<\/(p|div|li|tr|h[1-6])\s*>|<br\s*\/?>/giu;

/** Everything that is not text. Applied after the breaks above are preserved. */
const ANY_TAG = /<[^>]*>/gu;

/** The named entities this publisher's pages actually use. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  deg: "°",
};

/**
 * Turn `/laws/show/2947-14` into the URL that actually carries text.
 *
 * Kept here rather than in the register, because "the text is somewhere else"
 * is a fact about this publisher. `canonical_url` stays what §9.2 says it is —
 * the "whatever is currently in force" pointer, and the thing a lawyer would
 * recognise — and the fetcher derives the rest.
 */
export function printUrl(canonicalUrl: string): string {
  return `${canonicalUrl.replace(/\/+$/u, "")}/print`;
}

/**
 * The redaction date the publisher states for the act, from its shell page.
 *
 * §9.15 condition 1 lists "revision date parseable" among the assertions, and
 * this is where an unparseable one becomes `unreachable` rather than a norm that
 * quietly stops being dated.
 */
export function extractRedactionDate(shellHtml: string): RadaDate {
  const match = REDACTION_DATE.exec(shellHtml);
  if (match === null) return { ok: false, reason: "revision_date_unparsable" };

  const [, day, month, year] = match;
  if (day === undefined || month === undefined || year === undefined) {
    return { ok: false, reason: "revision_date_unparsable" };
  }

  return { ok: true, date: `${year}-${month}-${day}` };
}

/**
 * Extract one article's text from a print page.
 *
 * The heading is kept in the returned text, deliberately: an article's title is
 * part of it, and an amendment that retitles a provision without touching a
 * clause is a change a fingerprint should move for.
 *
 * The three refusals are §9.15 condition 1, and the distinction between the
 * second and the third is the one that took a sharpening of the spec to see.
 * "A heading was found" proves the parser read *an* article. It does not prove
 * it read *the* article, and §9.13 already names renumbering as a thing that
 * happens — so a parser satisfied by presence would follow the neighbouring
 * provision forever and report perfect stability while the cited one changed.
 */
export function extractArticle(printHtml: string, article: string): RadaExtraction {
  const wanted = normalizeArticle(article);
  if (!wanted.ok) return { ok: false, reason: "heading_mismatch" };

  const headings = [...printHtml.matchAll(ARTICLE_HEADING)].map((match) => ({
    at: match.index,
    end: match.index + match[0].length,
    number: normalizeArticle(match[1] ?? ""),
  }));

  if (headings.length === 0) return { ok: false, reason: "heading_missing" };

  const index = headings.findIndex(
    (heading) => heading.number.ok && heading.number.article === wanted.article,
  );

  const heading = index === -1 ? undefined : headings[index];
  if (heading === undefined) return { ok: false, reason: "heading_mismatch" };

  // Up to the next heading, or to the end of the document for the last article
  // of an act — which is a real boundary and not an edge case, since every act
  // has exactly one article in that position.
  const from = heading.at;
  const to = headings[index + 1]?.at ?? printHtml.length;

  // **Measured after the heading, and the first draft measured the whole slice.**
  // Since the heading is kept in the returned text, a check over the slice can
  // never see an empty string — the heading is always in it — so the assertion
  // was unfailable, which is the same as absent. The one shape it exists to
  // catch is exactly the one it could not see: a publisher who moves the text
  // and leaves the heading behind, which returns a confident "Стаття 105." and
  // nothing else. The test caught it on the first run.
  const body = toText(printHtml.slice(heading.end, to));
  if (body.trim().length === 0) return { ok: false, reason: "text_blank" };

  // Deliberately not the plausibility floor, which belongs to
  // `normalizeArticleText` and is applied to reduced text.
  return { ok: true, text: toText(printHtml.slice(from, to)) };
}

/**
 * HTML to text, keeping the line structure the reduction later relies on.
 *
 * Block ends become newlines *before* tags are stripped, so paragraphs survive
 * as paragraphs. Doing it the other way round welds an article into one line,
 * which fingerprints identically and reads appallingly — and the stored text
 * exists to be read (§9.7).
 */
function toText(html: string): string {
  return decodeEntities(html.replace(BLOCK_BREAK, "\n").replace(ANY_TAG, ""));
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (whole, body: string) => {
    if (body.startsWith("#")) {
      const codePoint =
        body.startsWith("#x") || body.startsWith("#X")
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);

      // An out-of-range or unreadable numeric entity is left as it was rather
      // than turned into a replacement character: a visible `&#99999999;` in a
      // diff is a question somebody asks, where U+FFFD is one they do not.
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : whole;
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}
