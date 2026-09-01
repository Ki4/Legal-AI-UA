// What the function decides: who may ask, what a reading does to the register,
// and which of those decisions a person's confirmation changes.
//
// The fetch path is `read.test.ts`'s subject and is stubbed here, so that a
// failing assertion in this file names a decision rather than a parser.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { NORMALIZER_VERSION } from "@legal-ai/law-refs";
import { handle, nextState, parseRequest } from "./handler.ts";
import type { HandlerDeps, NewRevision, NormStore, WatchedNorm } from "./handler.ts";

const FIXTURES = fileURLToPath(new URL("../../../packages/law-refs/fixtures/", import.meta.url));
const shell = readFileSync(`${FIXTURES}zakon-rada-2947-14-shell.html`, "utf8");
const print = readFileSync(`${FIXTURES}zakon-rada-2947-14-print-excerpt.html`, "utf8");

const CANONICAL = "https://zakon.rada.gov.ua/laws/show/2947-14";
const NORM_ID = "6f1b0f4a-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-01T10:00:00.000Z");
const LAWYER = { role: "lawyer" };

/** The register, as a variable. Records every write so a test can read it back. */
class FakeStore implements NormStore {
  norm: WatchedNorm | null;
  revisions: NewRevision[] = [];
  checks: { state: string; checkedAt: string; verifiedAt: string | null }[] = [];

  constructor(norm: WatchedNorm | null) {
    this.norm = norm;
  }

  load(normId: string): Promise<WatchedNorm | null> {
    return Promise.resolve(this.norm !== null && this.norm.id === normId ? this.norm : null);
  }

  insertRevision(revision: NewRevision): Promise<void> {
    this.revisions.push(revision);
    return Promise.resolve();
  }

  markChecked(update: {
    normId: string;
    state: string;
    checkedAt: string;
    verifiedAt: string | null;
  }): Promise<void> {
    this.checks.push({
      state: update.state,
      checkedAt: update.checkedAt,
      verifiedAt: update.verifiedAt,
    });
    return Promise.resolve();
  }
}

function norm(overrides: Partial<WatchedNorm> = {}): WatchedNorm {
  return {
    id: NORM_ID,
    canonicalUrl: CANONICAL,
    article: "105",
    state: "unverified",
    fingerprint: null,
    normalizerVersion: NORMALIZER_VERSION,
    ...overrides,
  };
}

function deps(store: NormStore, pages: Record<string, string> = defaultPages()): HandlerDeps {
  return {
    store,
    now: () => NOW,
    fetch: ((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = pages[url];
      if (body === undefined) return Promise.reject(new TypeError(`no page for ${url}`));
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as HandlerDeps["fetch"],
  };
}

function defaultPages(): Record<string, string> {
  return { [CANONICAL]: shell, [`${CANONICAL}/print`]: print };
}

/** The fingerprint the fixtures actually produce, read once through a preview. */
let knownFingerprint: string;

beforeEach(async () => {
  if (knownFingerprint !== undefined) return;
  const response = await handle(deps(new FakeStore(null)), LAWYER, {
    action: "preview",
    canonicalUrl: CANONICAL,
    article: "105",
  });
  const body = (await response.json()) as { reading: { fingerprint: string } };
  knownFingerprint = body.reading.fingerprint;
});

describe("handle — who may ask", () => {
  it("refuses a caller with no role before reaching the source", async () => {
    const store = new FakeStore(norm());
    const response = await handle(
      deps(store),
      { role: null },
      { action: "observe", normId: NORM_ID },
    );

    expect(response.status).toBe(403);
    expect(store.checks).toEqual([]);
  });

  it("refuses a client, who may read no norm at all", async () => {
    const response = await handle(
      deps(new FakeStore(norm())),
      { role: "client" },
      { action: "observe", normId: NORM_ID },
    );

    expect(response.status).toBe(403);
  });

  it("admits both staff roles, matching the revisions policy", async () => {
    for (const role of ["admin", "lawyer"]) {
      const response = await handle(
        deps(new FakeStore(norm())),
        { role },
        { action: "preview", canonicalUrl: CANONICAL, article: "105" },
      );
      expect(response.status).toBe(200);
    }
  });
});

describe("handle — preview", () => {
  it("returns the text and writes nothing", async () => {
    const store = new FakeStore(norm());

    const response = await handle(deps(store), LAWYER, {
      action: "preview",
      canonicalUrl: CANONICAL,
      article: "ст. 105",
    });
    const body = (await response.json()) as { ok: boolean; reading: { text: string } };

    expect(body.ok).toBe(true);
    expect(body.reading.text).toContain("Стаття 105");
    // The entire reason preview exists: `law_norms` has no delete path, so a
    // mistyped entry must be caught before a row is written.
    expect(store.revisions).toEqual([]);
    expect(store.checks).toEqual([]);
  });

  it("reports a wrong article number without writing a row", async () => {
    const store = new FakeStore(norm());

    const response = await handle(deps(store), LAWYER, {
      action: "preview",
      canonicalUrl: CANONICAL,
      article: "900",
    });
    const body = (await response.json()) as { ok: boolean; failure: { reason: string } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: false, failure: { reason: "heading_mismatch" } });
    expect(store.revisions).toEqual([]);
  });
});

describe("handle — observe", () => {
  it("records the first revision and leaves the norm unconfirmed", async () => {
    const store = new FakeStore(norm());

    const response = await handle(deps(store), LAWYER, { action: "observe", normId: NORM_ID });
    const body = (await response.json()) as { outcome: string; state: string; confirmed: boolean };

    expect(body).toMatchObject({ outcome: "first", state: "unverified", confirmed: false });
    expect(store.revisions).toHaveLength(1);
    expect(store.revisions[0]?.content).toContain("Стаття 105");
    expect(store.revisions[0]?.publishedRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // §9.10: nothing has been confirmed, so nothing is verified — the register
    // still reads this norm as never successfully checked, and should.
    expect(store.checks).toEqual([
      { state: "unverified", checkedAt: NOW.toISOString(), verifiedAt: null },
    ]);
  });

  it("verifies the norm when the fingerprint a lawyer was shown still matches", async () => {
    const store = new FakeStore(norm());

    const response = await handle(deps(store), LAWYER, {
      action: "observe",
      normId: NORM_ID,
      confirmedFingerprint: knownFingerprint,
    });
    const body = (await response.json()) as { state: string; confirmed: boolean };

    expect(body).toMatchObject({ state: "verified", confirmed: true });
    expect(store.checks[0]?.verifiedAt).toBe(NOW.toISOString());
  });

  it("does not carry a confirmation onto text the lawyer never read", async () => {
    // The half that makes the assertion above mean something: the article moved
    // between the preview and the save, so the words that were approved are not
    // the words now on record.
    const store = new FakeStore(norm());

    const response = await handle(deps(store), LAWYER, {
      action: "observe",
      normId: NORM_ID,
      confirmedFingerprint: `sha256:${"a".repeat(64)}`,
    });
    const body = (await response.json()) as { state: string; confirmed: boolean };

    expect(body).toMatchObject({ state: "unverified", confirmed: false });
    expect(store.checks[0]?.verifiedAt).toBeNull();
  });

  it("writes no revision when the text is unchanged", async () => {
    const store = new FakeStore(norm({ fingerprint: knownFingerprint, state: "verified" }));

    const response = await handle(deps(store), LAWYER, { action: "observe", normId: NORM_ID });
    const body = (await response.json()) as { outcome: string; state: string };

    expect(body).toMatchObject({ outcome: "unchanged", state: "verified" });
    // The guard trigger would refuse a duplicate anyway; not sending it is what
    // keeps `observed_at desc` meaning "when the text last moved".
    expect(store.revisions).toEqual([]);
    expect(store.checks[0]?.verifiedAt).toBe(NOW.toISOString());
  });

  it("records a drift when the stored fingerprint no longer matches", async () => {
    const store = new FakeStore(
      norm({ fingerprint: `sha256:${"b".repeat(64)}`, state: "verified" }),
    );

    const response = await handle(deps(store), LAWYER, { action: "observe", normId: NORM_ID });
    const body = (await response.json()) as { outcome: string; state: string };

    expect(body).toMatchObject({ outcome: "changed", state: "drifted" });
    expect(store.revisions).toHaveLength(1);
    expect(store.checks[0]?.verifiedAt).toBeNull();
  });

  it("marks a norm unreachable when the fetch fails, and says so on the record", async () => {
    const store = new FakeStore(norm({ fingerprint: knownFingerprint, state: "verified" }));

    const response = await handle(deps(store, {}), LAWYER, { action: "observe", normId: NORM_ID });
    const body = (await response.json()) as { ok: boolean; state: string };

    // §9.15 condition 1: never "no change". The check is recorded as having
    // happened and having failed, which is what stops a broken fetcher from
    // rendering as a quiet week.
    expect(body).toMatchObject({ ok: false, state: "unreachable" });
    expect(store.checks).toEqual([
      { state: "unreachable", checkedAt: NOW.toISOString(), verifiedAt: null },
    ]);
    expect(store.revisions).toEqual([]);
  });

  it("refuses an act-scoped norm rather than extracting an article it has none of", async () => {
    const store = new FakeStore(norm({ article: null }));

    const response = await handle(deps(store), LAWYER, { action: "observe", normId: NORM_ID });

    expect(response.status).toBe(422);
    expect(store.checks).toEqual([]);
  });

  it("refuses to probe a norm left behind by a normalizer bump", async () => {
    // The failure `law_norm_revisions.origin` exists to prevent, arriving from
    // the code: recording this as `observed` would drift every norm on the
    // morning of a bump with no way to tell our edit from the legislature's.
    const store = new FakeStore(
      norm({ fingerprint: knownFingerprint, normalizerVersion: NORMALIZER_VERSION + 1 }),
    );

    const response = await handle(deps(store), LAWYER, { action: "observe", normId: NORM_ID });

    expect(response.status).toBe(500);
    expect(store.revisions).toEqual([]);
    expect(store.checks).toEqual([]);
  });

  it("answers 404 for a norm that is not there", async () => {
    const response = await handle(deps(new FakeStore(null)), LAWYER, {
      action: "observe",
      normId: NORM_ID,
    });

    expect(response.status).toBe(404);
  });
});

describe("nextState", () => {
  it("returns a norm that came back from unreachable to unverified, not to verified", () => {
    // A fetch succeeding is not a person looking. This is the transition that
    // would otherwise quietly manufacture a confirmation nobody gave.
    expect(nextState("unreachable", "unchanged", false)).toBe("unverified");
  });

  it("leaves a lawyer's own states alone on an unchanged reading", () => {
    expect(nextState("under_review", "unchanged", false)).toBe("under_review");
    expect(nextState("impact_confirmed", "unchanged", false)).toBe("impact_confirmed");
  });

  it("makes any confirmed reading verified", () => {
    expect(nextState("drifted", "changed", true)).toBe("verified");
  });
});

describe("parseRequest", () => {
  it("accepts the two shapes the console sends", () => {
    expect(parseRequest({ action: "preview", canonicalUrl: CANONICAL, article: "105" })).toEqual({
      action: "preview",
      canonicalUrl: CANONICAL,
      article: "105",
    });
    expect(parseRequest({ action: "observe", normId: NORM_ID })).toEqual({
      action: "observe",
      normId: NORM_ID,
    });
  });

  it("refuses everything else, without throwing", () => {
    expect(parseRequest(null)).toBeNull();
    expect(parseRequest("observe")).toBeNull();
    expect(parseRequest({ action: "delete", normId: NORM_ID })).toBeNull();
    expect(parseRequest({ action: "observe", normId: "  " })).toBeNull();
    expect(parseRequest({ action: "preview", canonicalUrl: CANONICAL })).toBeNull();
    expect(
      parseRequest({ action: "observe", normId: NORM_ID, confirmedFingerprint: 7 }),
    ).toBeNull();
  });
});
