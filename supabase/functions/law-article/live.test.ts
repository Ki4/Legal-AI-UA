// The one test that talks to zakon.rada.gov.ua, and it is off by default.
//
// **Why it exists.** Every other test in this directory proves the fetcher
// against bytes saved on 2026-08-30. That is §9.15 condition 3 and it is worth
// exactly what it claims: it catches our own regressions and it cannot catch the
// publisher changing their markup — the failure the whole section is written
// against. Condition 4 answers that with a quarterly human spot-check. This is
// the cheap half of the same idea: one command, run deliberately, that says
// whether the parser still reads the live site.
//
// **Why it is off by default.** A test that reaches the network in CI is a test
// that turns a pull request red because a government website was slow. Worse, it
// would fail exactly when the site is down — which is not a defect in this
// repository, and a gate that goes red for reasons nobody can fix is a gate
// people learn to ignore.
//
//   LAW_LIVE=1 pnpm exec vitest run supabase/functions/law-article/live.test.ts
//
// If this fails while the rest of the directory passes, the fixtures have gone
// stale against the source: refresh them per `packages/law-refs/fixtures/README.md`
// and look at what changed before touching the parser.

import { describe, expect, it } from "vitest";
import { MIN_PLAUSIBLE_ARTICLE_LENGTH } from "@legal-ai/law-refs";
import { readArticle } from "./read.ts";

const live = process.env.LAW_LIVE === "1";

describe.skipIf(!live)("readArticle against the live source", () => {
  it("reads article 105 of the Family Code as published today", { timeout: 60_000 }, async () => {
    const result = await readArticle(
      { fetch: globalThis.fetch, now: () => new Date() },
      {
        canonicalUrl: "https://zakon.rada.gov.ua/laws/show/2947-14",
        article: "105",
      },
    );

    // Deliberately asserted through the failure value rather than around it:
    // if this is not ok, the reason is the interesting part of the report.
    expect(result.ok ? "ok" : result.failure.reason).toBe("ok");
    if (!result.ok) return;

    expect(result.reading.actId).toBe("2947-14");
    expect(result.reading.text).toContain("Стаття 105");
    expect(result.reading.text.length).toBeGreaterThan(MIN_PLAUSIBLE_ARTICLE_LENGTH);
    expect(result.reading.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.reading.publishedRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(
    "reports an article the act does not have, rather than inventing one",
    { timeout: 60_000 },
    async () => {
      const result = await readArticle(
        { fetch: globalThis.fetch, now: () => new Date() },
        {
          canonicalUrl: "https://zakon.rada.gov.ua/laws/show/2947-14",
          article: "9000",
        },
      );

      expect(result).toMatchObject({ ok: false, failure: { reason: "heading_mismatch" } });
    },
  );
});
