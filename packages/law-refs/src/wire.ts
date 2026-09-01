// What the console asks the fetcher, and what the fetcher answers (ADM-42).
//
// **Why the contract is here and not beside the function.** The fetcher is a
// Deno edge function under `supabase/functions/` (ADR-0020) and the console is
// a Vite app; neither can import the other's directory, and a payload shape
// written twice is two shapes that agree until the day they do not. This
// package is already the one thing both runtimes read — that is its entire
// reason for existing — so the request and response types live here beside the
// vocabulary they are made of. `ProbeFailure`, `LawNormState` and the
// fingerprint format are all defined a file away, and a contract that had to
// restate them would be restating the half most likely to drift.
//
// It stays pure, which is the rule this package is held to: these are type
// declarations and two constants. Nothing here fetches, and the function that
// does lives on the far side of the boundary.
//
// **This is not `packages/core-client`.** That package is the contract with the
// AI core, where a JSON Schema outranks all three runtimes because a Python
// service is one of them (ADR-0021). Here both sides are TypeScript reading one
// file, so the compiler is the enforcement and a schema would be ceremony.

import type { LawNormState, ProbeFailure } from "./types.ts";

/** The function's route, so the console and the deploy cannot disagree about it. */
export const ARTICLE_FUNCTION = "law-article";

/**
 * Read the article a lawyer is about to enter, and write nothing.
 *
 * **The reason this exists at all**, since §9.5.7 describes the confirmation as
 * happening after the save: `law_norms` has no delete grant and no delete policy
 * — deliberately, because a norm nothing depends on any more still carries the
 * history of what it was (`20260830120000`). So a mistyped article number
 * entered first and checked second is a permanent row in the register, watched
 * forever, matching nothing. §9.6 asks for the rejection "at the cheapest
 * possible moment"; the cheapest moment is before the row exists.
 */
export interface ArticlePreviewRequest {
  action: "preview";
  /** The "currently in force" pointer, as `normalizeLawLink` produced it. */
  canonicalUrl: string;
  /** The article, as the lawyer typed it. Normalized on the far side. */
  article: string;
}

/**
 * Read a norm that exists, record what was read, and say what moved.
 *
 * This is the whole of a check (§9.7) and the call ADM-44's scheduler will make
 * on a timer. It is the console's second call at entry, not its first: what a
 * lawyer confirms is what the register will actually be watching, so the text
 * shown against the saved row is fetched against the saved row.
 */
export interface ArticleObserveRequest {
  action: "observe";
  normId: string;
  /**
   * The fingerprint the lawyer was shown and acted on, when there is one.
   *
   * Present at entry — the preview's fingerprint, carried forward — and absent
   * for every scheduled check, which nobody is watching. When it matches what
   * this observation read, a person has confirmed this exact text and the norm
   * becomes `verified` (§9.11). When it does not, the article moved between the
   * preview and the save, and the confirmation is not transferred to text
   * nobody read.
   *
   * **Never the text itself.** A client that sends the article body is a client
   * that decides what the law says; the fingerprint travels because it can only
   * ever agree or disagree with what the server fetched for itself.
   */
  confirmedFingerprint?: string;
}

export type ArticleRequest = ArticlePreviewRequest | ArticleObserveRequest;

/** One reading of an article from its source. */
export interface ArticleReading {
  /** The act we actually landed on, after redirects (§9.15 condition 1). */
  actId: string;
  /** The article as `normalizeArticle` reduced it. */
  article: string;
  /** The normalized text, for a person to read. */
  text: string;
  fingerprint: string;
  normalizerVersion: number;
  /** The redaction date the publisher states, `YYYY-MM-DD`. */
  publishedRevisionDate: string | null;
  /** When this reading was taken, ISO 8601. */
  fetchedAt: string;
}

/**
 * Why a reading did not happen, in the vocabulary the register already uses.
 *
 * `detail` is for a human reading a log — a status code, a hostname — and is
 * never rendered as the reason. The screen's sentence comes from `reason`,
 * which is a closed set, because a fetch failure a lawyer cannot act on and one
 * they can (wrong article number) must not share a message.
 */
export interface ArticleFailure {
  reason: ProbeFailure;
  detail?: string;
}

/** What an observation did to the register. */
export type ArticleOutcome =
  /** Nothing was on record; this is the first thing the norm has ever said. */
  | "first"
  /** The fingerprint matched the one already stored. No revision was written. */
  | "unchanged"
  /** The text moved. A revision was written and the register adopted it. */
  | "changed";

export type ArticlePreviewResponse =
  { ok: true; reading: ArticleReading } | { ok: false; failure: ArticleFailure };

export type ArticleObserveResponse =
  | {
      ok: true;
      reading: ArticleReading;
      outcome: ArticleOutcome;
      /** The norm's state after the observation was recorded. */
      state: LawNormState;
      /** Whether `confirmedFingerprint` matched, and the norm is now confirmed. */
      confirmed: boolean;
    }
  | {
      ok: false;
      failure: ArticleFailure;
      /**
       * A failed observation still wrote: `last_checked_at` moved and the state
       * is `unreachable`. §9.15 condition 1 is the whole of this — "I don't
       * know" is an outcome the register holds, never an absence of one.
       */
      state: LawNormState;
    };

export type ArticleResponse = ArticlePreviewResponse | ArticleObserveResponse;
