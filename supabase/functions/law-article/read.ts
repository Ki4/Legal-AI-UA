// Reading one article off the live source (spec §9.7, §9.15, ADR-0020).
//
// The first thing in this repository that makes a network request, and the
// reason ADR-0020 exists: fetching an article contains no model call, so it is
// an edge function rather than the AI core, and it can be built before either
// `apps/core` or the gateway.
//
// **Everything about markup lives in `packages/law-refs`, and everything about
// requests lives here.** `rada.ts` is pure — HTML in, result out — so it can be
// proved against saved bytes, and this module owns the parts that cannot be:
// which URL is asked for, in which order, what a redirect means, and what a
// timeout is called. The split is what lets the parser's fixtures be real pages
// (§9.15 condition 3) without any of them needing a network.
//
// **Two requests, not one, and that is the design rather than a cost.**
// `canonical_url` — the page a lawyer recognises and the register stores — is a
// 34 KB JavaScript shell with no article text in it at all (ADR-0023). The text
// is at `/print`, 547 KB. §9.7 asks for a cheap probe and an expensive
// comparison and this is exactly that shape: the shell states the act's
// redaction date, and ADM-44 will fetch the print page only when that date has
// moved. Today both are fetched every time, because an entry-time confirmation
// has no previous date to compare against and a first observation has nothing
// stored — the saving is real only on the second check, which is the
// scheduler's, and the schedule is the next ticket.

import {
  extractArticle,
  extractRedactionDate,
  fingerprintRevision,
  normalizeArticle,
  normalizeLawLink,
  printUrl,
} from "@legal-ai/law-refs";
import type { ArticleFailure, ArticleReading } from "@legal-ai/law-refs";

export type ArticleReadResult =
  { ok: true; reading: ArticleReading } | { ok: false; failure: ArticleFailure };

/**
 * What this module needs from the world, so that every test can hand it
 * something else.
 *
 * `fetch` and a clock, and nothing more. A module that reached for the global
 * of either would be a module whose tests can only be run with a network and a
 * particular Tuesday.
 */
export interface ReadDeps {
  fetch: typeof globalThis.fetch;
  now: () => Date;
}

/** Long enough for 547 KB off a government site, short enough to fail a hung socket. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The ceiling on a response body.
 *
 * The print page of the largest code we watch is under 1 MB, so 8 is not a
 * limit anybody meets — it is the thing that stops a redirect into something
 * unbounded from being an out-of-memory in a shared runtime rather than a
 * refusal. It reports as `transport`, because from the register's point of view
 * the request did not usefully complete, and the byte count goes in `detail`
 * where whoever raises the threshold can read it.
 */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/**
 * Who is asking. A government publisher is entitled to know, and an
 * identifiable agent is the difference between being rate-limited and being
 * blocked — §9.14 chose to fetch this source ourselves, which makes being a
 * well-behaved client part of the deal rather than a courtesy.
 */
const USER_AGENT = "Legal-AI-UA law watcher (+https://github.com/Ki4/Legal-AI-UA)";

/**
 * Fetch, parse and fingerprint one article.
 *
 * Total, like everything in `packages/law-refs` and for a sharper reason: the
 * scheduled caller has nobody watching it, so a throw here is an unhandled
 * rejection in a Deno function where the register expected the word
 * `unreachable` (§9.15 condition 1). Every failure below is a value.
 */
export async function readArticle(
  deps: ReadDeps,
  input: { canonicalUrl: string; article: string },
): Promise<ArticleReadResult> {
  const wantedArticle = normalizeArticle(input.article);
  if (!wantedArticle.ok) {
    return fail("heading_mismatch", `article not recognised: ${input.article}`);
  }

  const wantedAct = normalizeLawLink(input.canonicalUrl);
  if (!wantedAct.ok) {
    // The register cannot hold such a row — `addReference` normalizes before it
    // writes — so this is a caller handing us something the register did not,
    // which is exactly the shape a future scheduler bug would have.
    return fail("act_identity_moved", `canonical_url does not normalize: ${input.canonicalUrl}`);
  }

  const shell = await get(deps, wantedAct.link.canonicalUrl);
  if (!shell.ok) return { ok: false, failure: shell.failure };

  // §9.15 condition 1, the half that is about *which act*: a redirect is not a
  // failed fetch. Acts get consolidated and rada moves them, so the page that
  // answers may honestly belong to a different act than the one in the
  // register — and a fetcher that accepted it would fingerprint a stranger's
  // article and report a stable norm forever. The same `normalizeLawLink` the
  // entry form uses, applied to where we actually landed.
  const landedAct = normalizeLawLink(shell.url);
  if (!landedAct.ok || landedAct.link.actId !== wantedAct.link.actId) {
    return fail("act_identity_moved", `asked for ${wantedAct.link.actId}, landed on ${shell.url}`);
  }

  const date = extractRedactionDate(shell.body);
  if (!date.ok) return fail(date.reason, "no span.dat0 on the act page");

  // Derived from where the shell actually resolved rather than from the stored
  // URL: the identity check above has already established the two name the same
  // act, and following the publisher's own current address is what keeps a
  // moved-but-equivalent URL from costing a second redirect on every check.
  const print = await get(deps, printUrl(shell.url));
  if (!print.ok) return { ok: false, failure: print.failure };

  const extracted = extractArticle(print.body, wantedArticle.article);
  if (!extracted.ok) return fail(extracted.reason);

  // Reduced and hashed in one call, because the two primitives exposed
  // separately make hashing raw markup one plausible mistake away — and that
  // mistake produces no error and no empty result, only a fingerprint of the
  // wrong thing (see `text.ts`).
  const revision = await fingerprintRevision(extracted.text);
  if (!revision.ok) {
    return fail(revision.reason === "blank" ? "text_blank" : "text_implausibly_short");
  }

  return {
    ok: true,
    reading: {
      actId: landedAct.link.actId,
      article: wantedArticle.article,
      text: revision.revision.text,
      fingerprint: revision.revision.fingerprint,
      normalizerVersion: revision.revision.normalizerVersion,
      publishedRevisionDate: date.date,
      fetchedAt: deps.now().toISOString(),
    },
  };
}

type Fetched = { ok: true; body: string; url: string } | { ok: false; failure: ArticleFailure };

/**
 * One GET, with every way it can go wrong turned into a `ProbeFailure`.
 *
 * Redirects are followed — that is the default and it is the right one here
 * (§9.15) — and `response.url` is where we ended up, which is the value the
 * identity check reads. A fetch that quietly did not follow them would make
 * that check compare a URL against itself.
 */
async function get(deps: ReadDeps, url: string): Promise<Fetched> {
  let response: Response;
  try {
    response = await deps.fetch(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // DNS, TLS, connection reset, and the abort above. One reason, because the
    // register's answer to all of them is the same and a screen that named them
    // apart would be naming things a lawyer cannot act on.
    return { ok: false, failure: { reason: "transport", detail: messageOf(error) } };
  }

  if (!response.ok) {
    return {
      ok: false,
      failure: {
        reason: "http_status",
        detail: `${response.status} ${response.statusText}`.trim(),
      },
    };
  }

  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      failure: { reason: "transport", detail: `content-length ${declared} over the ceiling` },
    };
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    // A body that dies mid-stream is a transport failure like any other, and it
    // arrives here rather than above because the headers had already succeeded.
    return { ok: false, failure: { reason: "transport", detail: messageOf(error) } };
  }

  // Checked again after reading, because `content-length` is optional and a
  // chunked response carries none — so the header check above is the cheap one
  // and this is the one that actually holds.
  if (body.length > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      failure: { reason: "transport", detail: `${body.length} characters over the ceiling` },
    };
  }

  // `response.url` is empty on a hand-built `Response`, which is what the tests
  // construct. Falling back to the requested URL keeps a test from failing the
  // identity check for a reason production does not have.
  return { ok: true, body, url: response.url === "" ? url : response.url };
}

function fail(reason: ArticleFailure["reason"], detail?: string): ArticleReadResult {
  return { ok: false, failure: detail === undefined ? { reason } : { reason, detail } };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
