// Normalizing a pasted link into the triple that is actually watched
// (ADR-0011, spec §9.2).
//
// Three failures this is built against, and only the first is obvious:
//
//   1. **The pinned-redaction trap.** A link may address a fixed historical
//      revision, and a lawyer will often paste exactly that, because it is the
//      revision they read. Watching it can never fire and the service stays
//      green permanently with no visible cause. So the revision is stripped and
//      the stripping is reported back.
//   2. **Mirror hosts.** `zakon2.rada.gov.ua` and friends serve the same acts.
//      Two links to one article must not become two rows in a register whose
//      whole premise is that a norm is watched once (§9.3).
//   3. **Link rot.** Acts get consolidated and URLs move — which this cannot
//      prevent, only fail loudly at. See the note on guessing, below.
//
// **On guessing.** The act identifier is not a single path segment: `2947-14`
// is, `254к/96-вр` is two, and neither the Constitution nor a ministry-
// registered act was going to be the shape the first example suggested. So the
// parse peels *known* trailing segments and treats what is left as the
// identifier, capped at two segments. If rada ever adds a trailing segment this
// list does not know, that segment gets folded into the identifier and the
// canonical URL rebuilt from it will not resolve — which surfaces as
// `unreachable` at fetch time (§9.10, §9.15), loudly, rather than as a norm
// that silently watches nothing. That is the intended failure direction and the
// reason this parser is allowed to be permissive at all.

import type { LawLinkResult } from "./types.ts";

/** The canonical host. Mirrors resolve to this one; nothing else is watched. */
const CANONICAL_HOST = "zakon.rada.gov.ua";

/** `zakon.rada.gov.ua` and the numbered mirrors `zakon1..zakon5`. */
const RADA_HOST = /^zakon\d*\.rada\.gov\.ua$/;

/** Every act page on this source lives under `/laws/show/`. */
const ACT_PATH_PREFIX = ["laws", "show"];

/**
 * Trailing segments that are a *view* of an act rather than part of its
 * identity. `ed20240101` is the pinned revision of §9.2; the rest are print
 * views, cards, paragraph anchors and pagination.
 */
const VIEW_SEGMENT = /^(ed\d{8}|print|conv|card|text|find|comp|page\d*|paran?\d+|sp:.+)$/i;

/** A pinned revision, which is the one view segment worth telling anyone about. */
const REVISION_SEGMENT = /^ed(\d{8})$/i;

/**
 * What an identifier segment may contain. Letters (Latin and Cyrillic alike —
 * `254к/96-вр` carries both), digits, and the three separators that appear in
 * real identifiers.
 */
const ID_SEGMENT = /^[\p{L}\p{N}._-]+$/u;

/** An act identifier is one segment, or two when the act is pre-1996. */
const MAX_ID_SEGMENTS = 2;

/**
 * Resolve a pasted URL to the norm it addresses.
 *
 * Total: every input returns a result and nothing throws, including the strings
 * that are not URLs at all (DoD §5 — a formatter that throws takes the whole
 * screen down with it, and this one runs on every keystroke of a paste).
 */
export function normalizeLawLink(input: string): LawLinkResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "not_a_url" };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!RADA_HOST.test(host)) {
    return { ok: false, reason: "unknown_source" };
  }

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const prefixMatches = ACT_PATH_PREFIX.every(
    (expected, index) => segments[index]?.toLowerCase() === expected,
  );
  if (!prefixMatches) {
    return { ok: false, reason: "not_an_act_url" };
  }

  // Everything after `/laws/show/`, with the view segments peeled off the tail.
  const rest = segments.slice(ACT_PATH_PREFIX.length).map((segment) => decodeSegment(segment));
  let strippedRevision: string | null = null;

  while (rest.length > 0) {
    const last = rest[rest.length - 1] as string;
    if (!VIEW_SEGMENT.test(last)) break;

    // Only the last revision seen is recorded, which is also the only one a
    // real URL carries.
    const revision = REVISION_SEGMENT.exec(last);
    if (revision) strippedRevision = revision[1] as string;

    rest.pop();
  }

  if (rest.length === 0 || rest.length > MAX_ID_SEGMENTS) {
    return { ok: false, reason: "unparsable_act_id" };
  }
  if (!rest.every((segment) => ID_SEGMENT.test(segment))) {
    return { ok: false, reason: "unparsable_act_id" };
  }

  const actId = rest.join("/").toLowerCase();

  return {
    ok: true,
    link: {
      source: "zakon_rada",
      actId,
      canonicalUrl: `https://${CANONICAL_HOST}/${ACT_PATH_PREFIX.join("/")}/${actId}`,
      strippedRevision,
    },
  };
}

/**
 * A percent-encoded segment read back as its characters, so that a Cyrillic
 * identifier pasted from a browser's address bar and one pasted from a link
 * produce the same row. Undecodable input is left as it stands and refused by
 * `ID_SEGMENT` a moment later — `decodeURIComponent` throws on a lone `%`.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
