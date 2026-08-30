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

/**
 * Why fetched article text was refused (§9.15 condition 2).
 *
 * Both values mean the same thing to the fetcher — the norm goes `unreachable`,
 * never "no change" — and they are still two values, because they mean
 * different things to whoever reads the log. `blank` is markup that returned
 * nothing at all; `implausibly-short` is markup that returned something, which
 * is the harder case and the one worth being able to count separately when the
 * threshold is next argued about.
 */
export type ArticleTextRejection = "blank" | "implausibly-short";

export type ArticleTextResult =
  { ok: true; text: string } | { ok: false; reason: ArticleTextRejection };

/**
 * Everything one row of `law_norm_revisions` needs, produced together.
 *
 * The three travel as one value because they are only meaningful together: a
 * fingerprint without the reduction that produced it cannot be compared against
 * anything later, and a `normalizerVersion` that does not describe *this* text
 * is the exact ambiguity the column exists to remove.
 */
export interface ArticleRevision {
  /** The reduced text, as `normalizeArticleText` leaves it. */
  text: string;
  /** `sha256:` and lowercase hex, over `text` and never over anything else. */
  fingerprint: string;
  /** Which reduction produced both. */
  normalizerVersion: number;
}

export type ArticleRevisionResult =
  { ok: true; revision: ArticleRevision } | { ok: false; reason: ArticleTextRejection };

/**
 * `public.law_norm_state`, kept in step by hand like `LawSource` and for the
 * same reason: this package holds no generated types so that Deno reads it.
 */
export type LawNormState =
  "unverified" | "verified" | "drifted" | "under_review" | "impact_confirmed" | "unreachable";

/** `public.law_revision_origin`. Whose doing a revision is (§9.7). */
export type RevisionOrigin = "observed" | "renormalized";

/**
 * Why a probe produced nothing usable (§9.15 condition 1).
 *
 * Every one of these is `unreachable` and **never** "no change" — that is the
 * whole of the condition. They stay separate values because a health screen
 * counting them apart is how a parser that broke is told from a site that is
 * down, and those need different people.
 */
export type ProbeFailure =
  /** The request never completed: DNS, timeout, connection reset. */
  | "transport"
  /** It completed and said no: a 4xx or 5xx. */
  | "http_status"
  /** We landed on a page belonging to a different act. See §9.15. */
  | "act_identity_moved"
  /** No article heading was found at all. */
  | "heading_missing"
  /** A heading was found and it names a different article than the one asked for. */
  | "heading_mismatch"
  /** A heading was found and the text under it was empty. */
  | "text_blank"
  /** Short enough that broken markup is the likelier explanation. */
  | "text_implausibly_short"
  /** The revision date was present and could not be read. */
  | "revision_date_unparsable";
