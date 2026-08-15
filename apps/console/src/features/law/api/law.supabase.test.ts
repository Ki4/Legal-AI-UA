// The mapping, tested without a database.
//
// `toNorm`, `dependentsByNorm` and `hoursOf` are exported for exactly this: they
// hold every decision the Supabase implementation makes that is not "run the
// query", and each is a place a wrong answer would look plausible — a stale norm
// rendered as fresh, a service title collapsed to nothing, a numeric column read
// as a string and silently becoming zero.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dependentsByNorm,
  hoursOf,
  supabaseLawApi,
  toNorm,
  type DependentQueryRow,
  type NormQueryRow,
} from "./law.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest. So the client is replaced rather
// than configured. The `order` calls are recorded because the decision worth
// checking leaves no trace in the rows that come back: the register is sorted by
// act, then article, then id, and dropping any of the three still returns rows.
const calls = vi.hoisted(() => ({ order: [] as unknown[][] }));
const result = vi.hoisted(() => ({ data: [] as unknown[], error: null as unknown }));

vi.mock("../../../app/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    in: () => chain,
    order: (...args: unknown[]) => {
      calls.order.push(args);
      return chain;
    },
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };

  return { supabase: { from: () => chain } };
});

beforeEach(() => {
  calls.order = [];
  result.data = [];
  result.error = null;
});

const NOW = Date.parse("2026-08-15T12:00:00.000Z");

function normRow(overrides: Partial<NormQueryRow> = {}): NormQueryRow {
  return {
    id: "norm-1",
    source: "zakon_rada",
    act_id: "2947-14",
    act_title: "Сімейний кодекс України",
    scope: "article",
    article: "105",
    act_scope_reason: null,
    source_url: "https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101",
    canonical_url: "https://zakon.rada.gov.ua/laws/show/2947-14",
    state: "verified",
    probe_interval_hours: 24,
    interval_reason: null,
    last_checked_at: "2026-08-15T04:00:00.000Z",
    last_verified_at: "2026-08-15T04:00:00.000Z",
    created_at: "2026-07-02T10:00:00.000Z",
    ...overrides,
  } as NormQueryRow;
}

describe("toNorm", () => {
  it("derives freshness rather than reading it off the row", () => {
    const fresh = toNorm(normRow(), [], NOW);
    expect(fresh.freshness).toEqual({
      kind: "fresh",
      verifiedAt: "2026-08-15T04:00:00.000Z",
    });

    // Same `state`, different answer. This pair is §9.10 in two assertions: the
    // last check found no difference, and there has not been one since.
    const stale = toNorm(normRow({ last_verified_at: "2026-07-01T04:00:00.000Z" }), [], NOW);
    expect(stale.state).toBe("verified");
    expect(stale.freshness.kind).toBe("stale");
  });

  it("keeps the pasted URL and the watched URL apart", () => {
    const norm = toNorm(normRow(), [], NOW);

    // §9.2: the link is kept for display, the canonical pointer is what a
    // fetcher asks for. A screen that showed one for the other would tell a
    // lawyer we are watching a revision that can never change.
    expect(norm.sourceUrl).toContain("ed20240101");
    expect(norm.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/2947-14");
  });

  it("carries the act-level exception and its reason together", () => {
    const norm = toNorm(
      normRow({ scope: "act", article: null, act_scope_reason: "Whole act; noise expected." }),
      [],
      NOW,
    );

    expect(norm.article).toBeNull();
    expect(norm.actScopeReason).toBe("Whole act; noise expected.");
  });
});

describe("dependentsByNorm", () => {
  it("groups every service resting on one norm under it", () => {
    const rows = [
      { norm_id: "norm-1", service_id: "svc-a", services: { title: "A" } },
      { norm_id: "norm-1", service_id: "svc-b", services: { title: "B" } },
      { norm_id: "norm-2", service_id: "svc-c", services: { title: "C" } },
    ] as unknown as DependentQueryRow[];

    const grouped = dependentsByNorm(rows);

    expect(grouped.get("norm-1")).toHaveLength(2);
    expect(grouped.get("norm-2")).toHaveLength(1);
    expect(grouped.get("norm-3")).toBeUndefined();
  });

  // The embed the generated types say cannot be null. It can: `db:types` reads
  // the foreign key and knows nothing about policies, and PostgREST answers a
  // row the reader may not see with null.
  it("renders a service it cannot read as visibly odd text rather than throwing", () => {
    const rows = [
      { norm_id: "norm-1", service_id: "svc-a", services: null },
    ] as unknown as DependentQueryRow[];

    expect(dependentsByNorm(rows).get("norm-1")).toEqual([
      { serviceId: "svc-a", serviceTitle: "" },
    ]);
  });
});

describe("hoursOf", () => {
  // `numeric` reaches the client as a string once it is large enough, and as a
  // number otherwise. Both are the same cadence.
  it("reads a numeric column in either shape it arrives in", () => {
    expect(hoursOf(24)).toBe(24);
    expect(hoursOf("168")).toBe(168);
  });

  it("falls back to zero rather than NaN, which no comparison is true of", () => {
    expect(hoursOf(null)).toBe(0);
    expect(hoursOf("not a number")).toBe(0);
  });
});

describe("listNorms", () => {
  it("asks for the register sorted by act, then article, then id", async () => {
    await supabaseLawApi.listNorms();

    expect(calls.order.map((args) => args[0])).toEqual(["act_title", "article", "id"]);
  });

  it("skips the dependents query entirely when the register is empty", async () => {
    const norms = await supabaseLawApi.listNorms();
    expect(norms).toEqual([]);
  });

  it("turns a failed read into an AppError rather than leaking Postgres", async () => {
    result.error = { code: "42501", message: "permission denied", details: "", hint: "" };

    await expect(supabaseLawApi.listNorms()).rejects.toMatchObject({
      name: "AppError",
      code: "forbidden",
    });
  });
});
