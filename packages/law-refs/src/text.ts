// Normalizing the text of a fetched article, and fingerprinting it (spec §9.7).
//
// This is the half of the watcher that decides what counts as a change. A
// fingerprint over raw markup moves every time the publisher reflows a table or
// swaps a quote character, and a lawyer who is paged three times for that stops
// reading the fourth — the failure §9.4 describes, arriving by a different road.
// So the text is reduced first, and only the reduction is hashed.
//
// **The reduction is deliberately aggressive, and that is safe only because the
// text is kept.** §9.7 stores the normalized text at every fingerprint change
// precisely so that our own rules can be revised: a stored text plus its
// `normalizerVersion` is something to recompute from, where a lone hash leaves
// every norm drifting at once on the morning we change a whitespace rule, with
// no way to tell our edit from the legislature's.
//
// **What is not normalized away.** Case, and the amendment footnotes rada
// carries inline (`{ Частину третю виключено на підставі Закону N 2947-14 }`).
// Both look like noise and neither is: a defined term is capitalized on
// purpose, and a footnote appearing is exactly the event being watched for.

import type { ArticleRevisionResult, ArticleTextResult } from "./types.ts";

/**
 * Which normalization produced a fingerprint. Stored beside it in
 * `law_norms.normalizer_version`, and the reason a change to the rules below is
 * a recomputation rather than two hundred false drifts.
 *
 * **Raise this in the same commit that changes any rule in `normalizeArticleText`.**
 * The default in `20260815140000_law_norm_register.sql` is 1 and the two are
 * held together by `text.test.ts`.
 */
export const NORMALIZER_VERSION = 1;

/**
 * Shortest extraction still treated as an article rather than as a broken
 * parse (§9.15 condition 2).
 *
 * The number is a judgement between two wrong answers, and it is exported so
 * that it is one number rather than three. Too low and empty markup passes as
 * content, which is the silent failure the whole condition exists to refuse.
 * Too high and a genuinely short article — a repealed one reduced to `Стаття
 * 15. Виключена.` — is reported `unreachable` when it has in fact just changed
 * in the most consequential way an article can.
 *
 * Twelve characters sits below every real article we have seen, including the
 * repeal stubs, and above every empty extraction. It is a tunable, and the CI
 * fixtures (§9.15 condition 3) are what should move it.
 */
export const MIN_PLAUSIBLE_ARTICLE_LENGTH = 12;

/** Zero-width characters and the soft hyphen: invisible, and pure markup noise. */
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/gu;

/** Every space that is not a space: non-breaking, narrow, figure, and the rest. */
const EXOTIC_SPACE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/gu;

/** Dash variants, down to one. A publisher switching en dash for em dash is not an amendment. */
const DASHES = /[\u2010-\u2015\u2212]/gu;

/**
 * Every character that ends a line: CRLF, and the two unicode separators U+2028
 * and U+2029.
 *
 * Those two are the ones that bite. They are invisible, they count as
 * whitespace, and the line split below does not see them -- so an untreated one
 * rides into the stored text and leaves the line around it untrimmed, moving a
 * fingerprint on a character no reader can find.
 *
 * The vertical tab and form feed were here briefly and were taken out again.
 * They are the same hazard in principle and there is no evidence the publisher
 * emits them, and a normalization rule is not free: every rule decides what
 * counts as a change, so one added on suspicion is a fingerprint moved for a
 * reason nobody can point at. Add them the day a fixture shows one.
 */
const LINE_BREAK = /\r\n?|[\u2028\u2029]/gu;

/** Double quotes in every style Ukrainian legal typography uses. */
const DOUBLE_QUOTES = /[\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033]/gu;

/** Single quotes and apostrophes, including the one that appears mid-word in `об'єкт`. */
const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032\u02BC]/gu;

/**
 * Reduce fetched article text to the form that is stored and hashed.
 *
 * Total in the same sense as `normalizeLawLink` and `normalizeArticle`: it
 * rejects rather than throws, because the caller is a scheduled fetcher with
 * nobody watching it, and an exception there is an unhandled rejection in a
 * Deno function rather than a norm marked `unreachable`.
 *
 * Line structure survives. Collapsing everything to one line would fingerprint
 * identically and read appallingly, and the text is kept to be *read* — by the
 * lawyer triaging a diff six months from now (§9.7).
 */
export function normalizeArticleText(input: string): ArticleTextResult {
  const text = input
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(EXOTIC_SPACE, " ")
    .replace(DASHES, "-")
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    // Every way of ending a line becomes the one way, before anything counts
    // lines. CRLF is the obvious member; the dangerous ones are U+2028 and
    // U+2029, which are invisible, count as whitespace, and are *not* seen by
    // the line split below -- so an untreated one rides into the stored text
    // and stops the line around it from being trimmed, which is a fingerprint
    // moving on a character no reader can see.
    .replace(LINE_BREAK, "\n")
    // Indentation and trailing spaces are the shape of the markup, not of the law.
    .split("\n")
    .map((line) => line.replace(/[ \t]+/gu, " ").trim())
    .join("\n")
    // A blank line separates paragraphs; six blank lines still separate paragraphs.
    .replace(/\n{2,}/gu, "\n\n")
    .trim();

  if (text.length === 0) return { ok: false, reason: "blank" };
  if (text.length < MIN_PLAUSIBLE_ARTICLE_LENGTH) {
    return { ok: false, reason: "implausibly-short" };
  }

  return { ok: true, text };
}

/**
 * Algorithm prefix on a stored fingerprint.
 *
 * A fingerprint says which algorithm produced it, so that changing the
 * algorithm is a readable event rather than two hundred hashes that no longer
 * compare. `normalizer_version` answers the neighbouring question — which text
 * reduction was hashed — and the two are separate axes: either can move without
 * the other, and a value carrying only one of them is ambiguous.
 *
 * `supabase/seed.sql` already writes this shape.
 */
const DIGEST_PREFIX = "sha256:";

/**
 * Fingerprint already-normalized text: `sha256:` and lowercase hex.
 *
 * Web Crypto rather than `node:crypto`, because this package is read unchanged
 * by Deno (ADR-0020) and `crypto.subtle` is a global in Node 22, Deno and the
 * browser alike. That it is async is the price, and it is paid by the two
 * callers rather than by a dependency.
 *
 * **Takes normalized text, and does not normalize — which it cannot enforce.**
 * Nothing in the type stops a caller handing it raw markup, and the result would
 * be a perfectly well-formed fingerprint of the wrong thing: either one that
 * never matches again, or one that stays stable while the article underneath it
 * changes. That is why `fingerprintRevision` below exists and is what the
 * fetcher calls. This one is the primitive, kept exported for the tests that
 * pin the digest itself.
 */
export async function fingerprintArticleText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${DIGEST_PREFIX}${hex}`;
}

/**
 * Reduce raw extracted text and fingerprint the reduction, in one call.
 *
 * **This is the function the fetcher uses, and the reason is a correctness one
 * rather than a convenience one.** With the two primitives exposed separately,
 * hashing raw markup is one plausible mistake away — and it is a mistake that
 * produces no error, no empty result and no failing test, only a fingerprint
 * that means something other than what every later comparison assumes. §9.15 is
 * a section about failures that look like health; this is one of them, arriving
 * from our own side rather than the publisher's.
 *
 * Here the reduction cannot be skipped, because there is no path from an input
 * to a fingerprint that does not go through it, and a refused input has no
 * fingerprint at all rather than a hash of nothing.
 */
export async function fingerprintRevision(input: string): Promise<ArticleRevisionResult> {
  const reduced = normalizeArticleText(input);
  if (!reduced.ok) return reduced;

  return {
    ok: true,
    revision: {
      text: reduced.text,
      fingerprint: await fingerprintArticleText(reduced.text),
      normalizerVersion: NORMALIZER_VERSION,
    },
  };
}
