// What a batch does, with the check itself stubbed at its edges.
//
// The check's own rules are `law-article/handler.test.ts`'s subject and are
// reached here only through a fake store and a fake `fetch`, so a failure in
// this file names a batch decision — kept going, stopped in time, honoured the
// order it was handed — rather than a parser or a state transition.

import { describe, expect, it } from "vitest";
import { authorizeSweep, clampBatch, DEFAULT_BATCH, MAX_BATCH, sweep } from "./sweep.ts";
import type { DueRegister, SweepDeps } from "./sweep.ts";
import type { NewRevision, NormStore, WatchedNorm } from "../law-article/handler.ts";

const CANONICAL = "https://zakon.rada.gov.ua/laws/show/2947-14";
const NOW = new Date("2026-09-07T03:00:00.000Z");
const SERVICE_KEY = "service-role-key-value";

/** A register that hands over ids and records what was asked of it. */
class FakeRegister implements DueRegister {
  asked: number[] = [];
  private readonly ids: string[];

  constructor(ids: string[]) {
    this.ids = ids;
  }

  due(batchLimit: number): Promise<string[]> {
    this.asked.push(batchLimit);
    return Promise.resolve(this.ids.slice(0, batchLimit));
  }
}

/**
 * A store where every norm exists and one nominated id explodes.
 *
 * The explosion is on `load`, which is the earliest point a real database
 * failure would surface and the one that proves the loop survives a norm it
 * could not even read.
 */
class FakeStore implements NormStore {
  checks: string[] = [];
  private readonly explodesOn: string | null;

  constructor(explodesOn: string | null = null) {
    this.explodesOn = explodesOn;
  }

  load(normId: string): Promise<WatchedNorm | null> {
    if (normId === this.explodesOn) return Promise.reject(new Error("connection reset"));
    if (normId === "missing") return Promise.resolve(null);
    return Promise.resolve({
      id: normId,
      canonicalUrl: CANONICAL,
      article: normId === "act-scoped" ? null : "105",
      state: "verified",
      fingerprint: "sha256:whatever",
      normalizerVersion: 1,
    });
  }

  revisions: NewRevision[] = [];

  insertRevision(revision: NewRevision): Promise<void> {
    this.revisions.push(revision);
    return Promise.resolve();
  }

  markChecked(update: { normId: string }): Promise<void> {
    this.checks.push(update.normId);
    return Promise.resolve();
  }
}

/** Every fetch fails, so each norm that reaches the network lands on `unreachable`. */
function deadNetwork(): typeof globalThis.fetch {
  return () => Promise.reject(new Error("network is down"));
}

function deps(overrides: Partial<SweepDeps> = {}): SweepDeps {
  return {
    fetch: deadNetwork(),
    now: () => NOW,
    store: new FakeStore(),
    register: new FakeRegister([]),
    ...overrides,
  };
}

describe("sweep", () => {
  it("checks every norm the register hands over, in that order", async () => {
    const store = new FakeStore();
    const report = await sweep(deps({ store, register: new FakeRegister(["a", "b", "c"]) }));

    expect(report.norms.map((n) => n.normId)).toEqual(["a", "b", "c"]);
    expect(report.checked).toBe(3);
    expect(report.stoppedEarly).toBe(false);
    // Every one of them was told a check happened, failure and all (§9.10).
    expect(store.checks).toEqual(["a", "b", "c"]);
  });

  it("keeps going after a norm throws, and says which one", async () => {
    const store = new FakeStore("b");
    const report = await sweep(deps({ store, register: new FakeRegister(["a", "b", "c"]) }));

    expect(report.norms.map((n) => n.verdict)).toEqual(["unreachable", "errored", "unreachable"]);
    expect(report.norms[1]?.detail).toBe("connection reset");
    // The point of the rule: the norms behind the bad one were still checked.
    expect(store.checks).toEqual(["a", "c"]);
    expect(report.verdicts).toEqual({ unreachable: 2, errored: 1 });
  });

  it("the same batch with nothing throwing leaves no errored verdict", async () => {
    // The other half of the rule above. A loop that swallowed everything would
    // pass the previous test just as well as one that catches what it should.
    const report = await sweep(deps({ register: new FakeRegister(["a", "b", "c"]) }));

    expect(report.verdicts.errored).toBeUndefined();
    expect(report.norms.every((n) => n.verdict === "unreachable")).toBe(true);
  });

  it("counts the kinds a check can come back with, without inventing a state", async () => {
    const report = await sweep(
      deps({ register: new FakeRegister(["missing", "act-scoped", "a"]) }),
    );

    expect(report.verdicts).toEqual({
      not_found: 1,
      act_scope_unsupported: 1,
      unreachable: 1,
    });
    // A norm that never reached a conclusion reports no state rather than a
    // plausible-looking one.
    expect(report.norms[0]?.state).toBeUndefined();
  });

  it("stops starting norms when the budget is spent, and says so", async () => {
    // A clock that advances 30 seconds per reading: the third look at it is
    // already past a 60-second budget.
    let ticks = 0;
    const now = (): Date => new Date(NOW.getTime() + 30_000 * ticks++);

    const report = await sweep(deps({ now, register: new FakeRegister(["a", "b", "c", "d"]) }), {
      budgetMs: 60_000,
    });

    expect(report.stoppedEarly).toBe(true);
    expect(report.checked).toBeLessThan(4);
    expect(report.due).toBe(4);
  });

  it("does not report stopping early when the whole batch fits", async () => {
    const report = await sweep(deps({ register: new FakeRegister(["a", "b"]) }), {
      budgetMs: 60_000,
    });

    expect(report.stoppedEarly).toBe(false);
    expect(report.checked).toBe(2);
  });

  it("asks the register for the clamped size, not the requested one", async () => {
    const register = new FakeRegister(["a"]);
    await sweep(deps({ register }), { batchLimit: 5_000 });

    expect(register.asked).toEqual([MAX_BATCH]);
  });
});

describe("clampBatch", () => {
  it("keeps a sane request", () => {
    expect(clampBatch(10)).toBe(10);
  });

  it("falls back to the default rather than refusing nonsense", () => {
    // The caller is a scheduler; a 400 would be read by nobody.
    expect(clampBatch(undefined)).toBe(DEFAULT_BATCH);
    expect(clampBatch("40")).toBe(DEFAULT_BATCH);
    expect(clampBatch(0)).toBe(DEFAULT_BATCH);
    expect(clampBatch(-3)).toBe(DEFAULT_BATCH);
    expect(clampBatch(Number.NaN)).toBe(DEFAULT_BATCH);
    expect(clampBatch(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BATCH);
  });

  it("caps a large one", () => {
    expect(clampBatch(MAX_BATCH + 1)).toBe(MAX_BATCH);
  });

  it("floors a fraction instead of asking the database for 2.5 rows", () => {
    expect(clampBatch(2.5)).toBe(2);
  });
});

describe("authorizeSweep", () => {
  const secrets = { serviceRoleKey: SERVICE_KEY };

  it("admits an admin", () => {
    expect(authorizeSweep({ role: "admin", bearer: null }, secrets)).toBe(true);
  });

  it("admits the service-role key, which is what the scheduler will hold", () => {
    expect(authorizeSweep({ role: null, bearer: SERVICE_KEY }, secrets)).toBe(true);
  });

  it("refuses a lawyer, who has no business re-checking the whole register", () => {
    expect(authorizeSweep({ role: "lawyer", bearer: null }, secrets)).toBe(false);
  });

  it("refuses a wrong key, and one that is merely a prefix of the right one", () => {
    expect(authorizeSweep({ role: null, bearer: "wrong" }, secrets)).toBe(false);
    expect(authorizeSweep({ role: null, bearer: SERVICE_KEY.slice(0, -1) }, secrets)).toBe(false);
  });

  it("refuses everything when no key is configured", () => {
    // Otherwise a function deployed without its secret would authorize an empty
    // bearer against an empty expectation — the shape where absent means open.
    expect(authorizeSweep({ role: null, bearer: "" }, { serviceRoleKey: "" })).toBe(false);
  });
});
