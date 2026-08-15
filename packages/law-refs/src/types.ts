// What a pasted link resolves to, and what a refusal says.
//
// The vocabulary of ADR-0011: the lawyer supplies a URL, and the thing actually
// tracked is the triple of source, act identifier and article plus a pointer
// meaning "whatever is currently in force". The URL survives for display only.

/**
 * Where a norm is published. An enum rather than a hostname, because the
 * database column is an enum for the same reason: adding a second source is a
 * migration and a decision, not a string somebody types.
 *
 * Kept in step with `public.law_source` by hand — this package holds no
 * generated types, deliberately, so that Deno can read it.
 */
export type LawSource = "zakon_rada";

export interface NormalizedLawLink {
  source: LawSource;
  /**
   * The act as its source names it: `2947-14`, `z0123-19`, `254к/96-вр`. Kept
   * lowercased, because it is half of the uniqueness of a norm and two rows
   * differing only in case would be the same norm watched twice — which is the
   * one thing §9.3 exists to prevent.
   */
  actId: string;
  /** The "currently in force" pointer. What gets fetched; never the pasted URL. */
  canonicalUrl: string;
  /**
   * The `edYYYYMMDD` revision that was pasted and resolved away, or null.
   *
   * Not an error, and not silent either. §9.5.1 tells the lawyer to paste the
   * revision they were reading and promises the system resolves it; §9.2 says
   * watching that revision could never fire, because the text behind it is
   * immutable by definition. So it is stripped — and returned, so the screen
   * can say it was, rather than quietly changing what somebody asked for.
   */
  strippedRevision: string | null;
}

/**
 * Why a link could not be normalized. A closed set, because each one gets its
 * own sentence on the entry form — a single "bad link" would tell a lawyer who
 * pasted a court-practice page the same thing as one who pasted a valid act
 * from a source we do not watch.
 */
export type LawLinkRejection =
  /** Not a URL at all. */
  | "not_a_url"
  /** A URL, on a host this platform does not watch. */
  | "unknown_source"
  /** The right host, but not an act page — a search result, the front page. */
  | "not_an_act_url"
  /** An act page whose identifier this parser will not guess at. See link.ts. */
  | "unparsable_act_id";

export type LawLinkResult =
  { ok: true; link: NormalizedLawLink } | { ok: false; reason: LawLinkRejection };

/** Why an article designator was refused. Same reasoning as the set above. */
export type ArticleRejection = "blank" | "unrecognized";

export type ArticleResult = { ok: true; article: string } | { ok: false; reason: ArticleRejection };
