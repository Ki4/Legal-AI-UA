// What the function decides, with nothing that knows about Deno or Postgres.
//
// `index.ts` is twenty lines of wiring around this: it builds a real `fetch`, a
// real database client and a real clock, and hands them over. Everything worth
// asserting is here, so the tests run under the workspace's Vitest like every
// other test in the repository rather than needing a second runner and a second
// CI lane for one file (ADR-0016 keeps exactly one non-TypeScript lane, and this
// is not it — it is TypeScript on a second runtime).
//
// **The two actions and why they are one function.** `preview` reads and writes
// nothing; `observe` reads the same way and records what it read. Splitting them
// into two endpoints would have duplicated the fetch path, and the fetch path is
// where §9.15's assertions live — two copies is the shape that lets one of them
// quietly stop asserting.

import { NORMALIZER_VERSION } from "@legal-ai/law-refs";
import type {
  ArticleObserveRequest,
  ArticleOutcome,
  ArticleRequest,
  ArticleResponse,
  LawNormState,
} from "@legal-ai/law-refs";
import { readArticle } from "./read.ts";
import type { ReadDeps } from "./read.ts";

/** A norm as this function needs to see it. A slice of `law_norms`, not the row. */
export interface WatchedNorm {
  id: string;
  canonicalUrl: string;
  /** Null exactly when the scope is the whole act — which this function refuses. */
  article: string | null;
  state: LawNormState;
  fingerprint: string | null;
  normalizerVersion: number;
}

/** What a revision insert carries. `origin` is asserted, never inferred (§9.7). */
export interface NewRevision {
  normId: string;
  fingerprint: string;
  normalizerVersion: number;
  content: string;
  publishedRevisionDate: string | null;
}

/**
 * The database, as three verbs.
 *
 * A port rather than a Supabase client, so the decisions below are testable
 * without a database and so the one place that speaks PostgREST is `index.ts`.
 * The three verbs are exactly what §9.7 describes a check doing, which is the
 * check that this interface has not grown into "the tables, but as methods".
 */
export interface NormStore {
  /** The norm, or null when no such row is visible. */
  load(normId: string): Promise<WatchedNorm | null>;
  /**
   * Record a new revision. The `law_norms_adopt_revision` trigger carries the
   * fingerprint onto the register, so nothing here writes it — the register and
   * the log cannot disagree because only one of them is ever written to.
   */
  insertRevision(revision: NewRevision): Promise<void>;
  /**
   * The three columns the trigger deliberately leaves alone, because two of
   * them are judgements: whether a check happened, and whether what it found is
   * what somebody confirmed.
   */
  markChecked(update: {
    normId: string;
    state: LawNormState;
    checkedAt: string;
    /** Set only on a check that succeeded *and* matched a confirmation (§9.10). */
    verifiedAt: string | null;
  }): Promise<void>;
}

export interface HandlerDeps extends ReadDeps {
  store: NormStore;
}

/** Who may ask. Both staff roles, matching `law_norm_revisions_select_staff`. */
const ALLOWED_ROLES = ["admin", "lawyer"];

export interface Caller {
  role: string | null;
}

/**
 * Answer one request.
 *
 * Returns a `Response` rather than a value because the status code is part of
 * what it decides: a wrong article number is a 200 carrying `ok: false` — the
 * fetch worked and the answer is "not that article" — where a caller with no
 * role is a 403 and never reaches the source at all. Collapsing those into one
 * shape would make a permission problem look like a parser problem in every log
 * that follows.
 */
export async function handle(
  deps: HandlerDeps,
  caller: Caller,
  request: unknown,
): Promise<Response> {
  if (caller.role === null || !ALLOWED_ROLES.includes(caller.role)) {
    return json(403, { error: "forbidden" });
  }

  const parsed = parseRequest(request);
  if (parsed === null) return json(400, { error: "bad_request" });

  return parsed.action === "preview"
    ? await preview(deps, parsed.canonicalUrl, parsed.article)
    : await observe(deps, parsed);
}

async function preview(
  deps: HandlerDeps,
  canonicalUrl: string,
  article: string,
): Promise<Response> {
  const read = await readArticle(deps, { canonicalUrl, article });

  return json(
    200,
    read.ok ? { ok: true, reading: read.reading } : { ok: false, failure: read.failure },
  );
}

async function observe(deps: HandlerDeps, request: ArticleObserveRequest): Promise<Response> {
  const norm = await deps.store.load(request.normId);
  if (norm === null) return json(404, { error: "not_found" });

  // §9.4 makes the article the tracked unit and marks act-level scope as the
  // exception; the parser is article-keyed, so an act-scoped norm has nothing
  // for it to extract. Refused loudly rather than answered with a shrug: the
  // act-level watch is the redaction date on the shell page and it belongs to
  // the scheduler (ADM-44), where the cheap probe already lives.
  if (norm.article === null) return json(422, { error: "act_scope_unsupported" });

  // A normalizer bump is a recomputation pass over the whole register, not
  // something a probe discovers one norm at a time. §9.7 is explicit that the
  // `renormalized` label is asserted by the component that can compare old rules
  // against new — and this one cannot: `packages/law-refs` holds one reduction,
  // the current one, so there is nothing here to reduce under the old rules.
  //
  // The tempting fallback is to record `observed` and move on. That is the
  // failure the `origin` column was added to prevent, arriving from the code
  // instead of the schema: every norm goes `drifted` on the morning of a bump,
  // each with a one-business-day clock (§9.16), and nothing distinguishes our
  // edit from the legislature's. So it refuses, loudly, and the norm keeps its
  // stale `last_checked_at` — which §9.10 will raise on its own.
  if (norm.fingerprint !== null && norm.normalizerVersion !== NORMALIZER_VERSION) {
    return json(500, {
      error: "normalizer_mismatch",
      detail: `norm is at normalizer ${norm.normalizerVersion}, this fetcher is at ${NORMALIZER_VERSION}; a bump needs a recomputation pass, not a probe`,
    });
  }

  const read = await readArticle(deps, {
    canonicalUrl: norm.canonicalUrl,
    article: norm.article,
  });

  if (!read.ok) {
    // §9.15 condition 1, and the reason this branch writes at all: "I don't
    // know" is a state the register holds. A failed check that left no trace
    // would render as a norm nobody had got around to checking yet, which is
    // the one thing §9.10 refuses to let look like health.
    const checkedAt = deps.now().toISOString();
    await deps.store.markChecked({
      normId: norm.id,
      state: "unreachable",
      checkedAt,
      verifiedAt: null,
    });

    return json(200, { ok: false, failure: read.failure, state: "unreachable" });
  }

  const { reading } = read;
  const outcome: ArticleOutcome =
    norm.fingerprint === null
      ? "first"
      : norm.fingerprint === reading.fingerprint
        ? "unchanged"
        : "changed";

  // The confirmation is a person saying "this is the norm I meant" about text
  // they actually read (§9.5.7). It travels as the fingerprint of what they were
  // shown, so a text that moved between the preview and the save carries no
  // confirmation forward — the words a lawyer approved are the only words the
  // approval is about.
  const confirmed =
    request.confirmedFingerprint !== undefined &&
    request.confirmedFingerprint === reading.fingerprint;

  if (outcome !== "unchanged") {
    await deps.store.insertRevision({
      normId: norm.id,
      fingerprint: reading.fingerprint,
      normalizerVersion: reading.normalizerVersion,
      content: reading.text,
      publishedRevisionDate: reading.publishedRevisionDate,
    });
  }

  const state = nextState(norm.state, outcome, confirmed);

  // **`verified` is not "a check succeeded".** §9.10 wants the column to mean
  // the last check that succeeded *and* matched what somebody confirmed, so an
  // unchanged reading of a norm nobody has ever confirmed does not move it —
  // that norm reads as `never_checked` on the register (`freshness.ts`) and it
  // should, because nothing has ever agreed that the text is the right one.
  const verifiedAt = state === "verified" ? reading.fetchedAt : null;

  await deps.store.markChecked({
    normId: norm.id,
    state,
    checkedAt: reading.fetchedAt,
    verifiedAt,
  });

  return json(200, { ok: true, reading, outcome, state, confirmed });
}

/**
 * The state a norm is in after an observation (§9.11).
 *
 * Written as one function because the transitions are the feature, and a
 * transition table spread across three call sites is a table nobody can read as
 * a whole. Two rules carry it: a person's confirmation is what produces
 * `verified`, and a change nobody has confirmed produces `drifted` — the state
 * whose definition is "the fingerprint moved and nobody has looked yet".
 */
export function nextState(
  current: LawNormState,
  outcome: ArticleOutcome,
  confirmed: boolean,
): LawNormState {
  if (confirmed) return "verified";

  switch (outcome) {
    case "first":
      // Read, recorded, and nobody has said it is the right article. Which is
      // exactly what `unverified` means, and it is where a norm entered through
      // the scheduler rather than through a form would also sit.
      return "unverified";
    case "changed":
      return "drifted";
    case "unchanged":
      // A norm somebody had already confirmed stays confirmed; one that was
      // `unreachable` and now reads clean returns to `unverified` rather than
      // to `verified`, because a fetch coming back is not a person looking.
      // `under_review` and `impact_confirmed` are a lawyer's, and an unchanged
      // reading is not the fetcher's business to overrule (ADM-46 moves them).
      return current === "unreachable" ? "unverified" : current;
  }
}

/**
 * Parse the body into a request, or refuse it.
 *
 * Hand-written rather than a schema library, because this package chain is
 * dependency-free by design (ADR-0020) and there are two shapes. It is total: a
 * body that is not an object, or names an action nobody serves, is `null` and
 * becomes a 400.
 */
export function parseRequest(body: unknown): ArticleRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;

  if (record.action === "preview") {
    const { canonicalUrl, article } = record;
    if (typeof canonicalUrl !== "string" || typeof article !== "string") return null;
    if (canonicalUrl.trim() === "" || article.trim() === "") return null;
    return { action: "preview", canonicalUrl, article };
  }

  if (record.action === "observe") {
    const { normId, confirmedFingerprint } = record;
    if (typeof normId !== "string" || normId.trim() === "") return null;
    if (confirmedFingerprint !== undefined && typeof confirmedFingerprint !== "string") return null;
    return confirmedFingerprint === undefined
      ? { action: "observe", normId }
      : { action: "observe", normId, confirmedFingerprint };
  }

  return null;
}

function json(status: number, body: ArticleResponse | Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
