// Normalizing the article a lawyer types (spec §9.5.2).
//
// The article is typed rather than read out of the URL, and that is a decision
// rather than a shortcut: the `#n123` anchor a rada link carries is an internal
// paragraph id, not an article number, and reading it as one would produce a
// register full of confident nonsense. §9.5.2 asks the lawyer to name the
// article; this normalizes what they named.
//
// **The part or point is deliberately not captured here.** §9.4 fixes the
// article as the tracked unit, so "частина 3 статті 75" is watched as article
// 75; which part the block leans on belongs in the one-line `relied_on`
// sentence (§9.5.6), where a reader meeting a diff in six months will actually
// look. Splitting it into a column would imply a granularity nothing fetches.

import type { ArticleResult } from "./types.ts";

/**
 * Ukrainian and English ways of writing the word before the number. Longest
 * first: `ст\.?` would otherwise match the opening of `стаття` and leave `аття`
 * behind, which then fails as unrecognized — a refusal for the one input the
 * rule exists to accept.
 */
const ARTICLE_WORD = /^(статтею|стаття|статті|ст\.?|article|art\.?)\s*/iu;

/** Superscript digits, as used in `ст. 75¹`. An index here is the digit it means. */
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Every dash that arrives from pasted text: U+2010…U+2015, and the minus sign. */
const DASHES = /[‐-―−]/gu;

/**
 * What a normalized article looks like: a number, optionally with the `-1`
 * suffix that marks an article inserted between two others.
 */
const CANONICAL = /^\d+(-\d+)?$/;

/**
 * Reduce a typed article designator to the form the register stores.
 *
 * Total, like `normalizeLawLink` and for the same reason.
 */
export function normalizeArticle(input: string): ArticleResult {
  let text = input.trim();
  if (text.length === 0) return { ok: false, reason: "blank" };

  text = text.replace(ARTICLE_WORD, "");

  // `75¹` and `75-1` are the same article written two ways, and both appear in
  // Ukrainian legislation. One row, so one spelling.
  text = text.replace(
    new RegExp(`[${SUPERSCRIPTS}]+`, "gu"),
    (run) => `-${[...run].map((mark) => SUPERSCRIPTS.indexOf(mark)).join("")}`,
  );

  text = text.replace(DASHES, "-");

  // `75 - 1` and `75 -1` are the same article typed loosely.
  text = text.replace(/\s*-\s*/gu, "-").trim();

  // A trailing full stop survives "ст. 75." and means nothing.
  text = text.replace(/\.$/u, "");

  if (!CANONICAL.test(text)) return { ok: false, reason: "unrecognized" };

  return { ok: true, article: text };
}
