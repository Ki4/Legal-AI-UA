// The fetch path, against the saved pages of §9.15 condition 3.
//
// Two things are being asserted and they are worth telling apart. The parser's
// own behaviour is `packages/law-refs/src/rada.test.ts`'s job and is not
// repeated here. What is here is everything that is true of the *requests*: that
// the shell is fetched before the print page, that a redirect onto another act
// is refused, that every network failure becomes a `ProbeFailure` and none of
// them throws — the half that only exists once something makes a request.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readArticle } from "./read.ts";
import type { ReadDeps } from "./read.ts";

const FIXTURES = fileURLToPath(new URL("../../../packages/law-refs/fixtures/", import.meta.url));

const shell = readFileSync(`${FIXTURES}zakon-rada-2947-14-shell.html`, "utf8");
const print = readFileSync(`${FIXTURES}zakon-rada-2947-14-print-excerpt.html`, "utf8");

const CANONICAL = "https://zakon.rada.gov.ua/laws/show/2947-14";
const NOW = new Date("2026-09-01T10:00:00.000Z");

/**
 * A fetch that answers from a table of URLs, and records what it was asked for
 * in the order it was asked.
 *
 * The order is an assertion of its own: §9.7's cheap-probe design only holds if
 * the 34 KB shell is what decides whether the 547 KB print page is fetched at
 * all, and a fetcher that asked for them the other way round would pass every
 * other test in this file.
 */
function fetcher(
  pages: Record<string, { body?: string; status?: number; url?: string; throws?: Error }>,
): { deps: ReadDeps; asked: string[] } {
  const asked: string[] = [];

  const deps: ReadDeps = {
    now: () => NOW,
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      asked.push(url);

      const page = pages[url];
      if (page === undefined) throw new TypeError(`no page for ${url}`);
      if (page.throws) throw page.throws;

      const response = new Response(page.body ?? "", { status: page.status ?? 200 });
      // `Response.url` is read-only and empty on a hand-built response, so a
      // redirect is expressed by overriding it — which is also the only way to
      // test the identity check without a network.
      if (page.url !== undefined) {
        Object.defineProperty(response, "url", { value: page.url });
      }
      return response;
    }) as ReadDeps["fetch"],
  };

  return { deps, asked };
}

describe("readArticle", () => {
  it("reads an article, fingerprints it, and dates it from the shell", async () => {
    const { deps, asked } = fetcher({
      [CANONICAL]: { body: shell },
      [`${CANONICAL}/print`]: { body: print },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "стаття 105" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.reading.actId).toBe("2947-14");
    expect(result.reading.article).toBe("105");
    expect(result.reading.text).toContain("Стаття 105");
    expect(result.reading.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.reading.publishedRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.reading.fetchedAt).toBe(NOW.toISOString());

    // The shell first, and the print page only after it answered. This is the
    // ordering ADM-44's cheap probe depends on.
    expect(asked).toEqual([CANONICAL, `${CANONICAL}/print`]);
  });

  it("never fetches the print page when the shell is unreachable", async () => {
    const { deps, asked } = fetcher({
      [CANONICAL]: { throws: new TypeError("connection reset") },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "transport" } });
    expect(asked).toEqual([CANONICAL]);
  });

  it("reports a 404 as http_status rather than as no change", async () => {
    const { deps } = fetcher({ [CANONICAL]: { status: 404, body: "" } });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "http_status" } });
  });

  it("refuses a redirect that landed on a different act", async () => {
    // §9.15: acts get consolidated and rada moves them, so a page that answers
    // may honestly belong to another act. Fingerprinting it would report a
    // stable norm forever while the cited provision changed elsewhere.
    const { deps, asked } = fetcher({
      [CANONICAL]: { body: shell, url: "https://zakon.rada.gov.ua/laws/show/1404-19" },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "act_identity_moved" } });
    expect(asked).toEqual([CANONICAL]);
  });

  it("accepts a redirect that stays on the same act, and follows it for the text", async () => {
    // The other half of the rule above, and the one that keeps it from being a
    // check that refuses everything: a mirror or a trailing slash is the same
    // act, and the print page is then derived from where we actually landed.
    const { deps, asked } = fetcher({
      [CANONICAL]: { body: shell, url: "https://zakon2.rada.gov.ua/laws/show/2947-14" },
      ["https://zakon2.rada.gov.ua/laws/show/2947-14/print"]: { body: print },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result.ok).toBe(true);
    expect(asked[1]).toBe("https://zakon2.rada.gov.ua/laws/show/2947-14/print");
  });

  it("reports an article the act does not contain as heading_mismatch", async () => {
    const { deps } = fetcher({
      [CANONICAL]: { body: shell },
      [`${CANONICAL}/print`]: { body: print },
    });

    // The excerpt holds articles 103-109. 900 is the lawyer's typo, and it is
    // the one failure on this list that a person can act on.
    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "900" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "heading_mismatch" } });
  });

  it("reports markup with no headings at all as heading_missing", async () => {
    const { deps } = fetcher({
      [CANONICAL]: { body: shell },
      [`${CANONICAL}/print`]: { body: "<html><body><p>Технічні роботи</p></body></html>" },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "heading_missing" } });
  });

  it("reports a shell with no redaction date rather than dating the revision null", async () => {
    const { deps, asked } = fetcher({
      [CANONICAL]: { body: "<html><body>no date here</body></html>" },
      [`${CANONICAL}/print`]: { body: print },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "revision_date_unparsable" } });
    expect(asked).toEqual([CANONICAL]);
  });

  it("refuses a body over the ceiling instead of holding it", async () => {
    const { deps } = fetcher({
      [CANONICAL]: { body: shell },
      [`${CANONICAL}/print`]: { body: "x".repeat(9 * 1024 * 1024) },
    });

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "105" });

    expect(result).toMatchObject({ ok: false, failure: { reason: "transport" } });
  });

  it("refuses an article designator it cannot read without making a request", async () => {
    const { deps, asked } = fetcher({});

    const result = await readArticle(deps, { canonicalUrl: CANONICAL, article: "  " });

    expect(result).toMatchObject({ ok: false, failure: { reason: "heading_mismatch" } });
    expect(asked).toEqual([]);
  });
});
