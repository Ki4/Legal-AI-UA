// The mapping, tested without a database.
//
// `toReviewer` and `toOrderListItem` are exported for exactly this: they hold
// every decision the Supabase implementation makes that is not "run the query",
// and they are where a wrong one would be invisible — a collapsed reviewer
// state and a null service title both render as something plausible.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  supabaseOrdersApi,
  toOrderListItem,
  toReviewer,
  type OrderQueryRow,
} from "./orders.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest. So the client is replaced here
// rather than configured — the same stub shape the service-history test next
// door uses, kept minimal because one query is all this implementation runs.
//
// The calls are recorded because the two decisions worth checking leave no
// trace in the rows that come back: that the list is asked for one row past the
// limit, and that it is ordered by `placed_at` *and* by id. Remove either and
// every assertion about the data still passes.
const calls = vi.hoisted(() => ({ order: [] as unknown[][], limit: [] as unknown[][] }));
const result = vi.hoisted(() => ({ data: [] as unknown[], error: null as unknown }));

vi.mock("../../../app/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: (...args: unknown[]) => {
      calls.order.push(args);
      return chain;
    },
    limit: (...args: unknown[]) => {
      calls.limit.push(args);
      return chain;
    },
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };

  return { supabase: { from: () => chain } };
});

beforeEach(() => {
  calls.order = [];
  calls.limit = [];
  result.data = [];
  result.error = null;
});

function row(overrides: Partial<OrderQueryRow> = {}): OrderQueryRow {
  return {
    id: "ord-1",
    client_id: "cli-1",
    status: "in_review",
    human_review_requested: false,
    reviewer_id: null,
    placed_at: "2026-08-10T09:15:00.000Z",
    clients: { pseudonym: "client-4f2a91" },
    service_versions: {
      version: 2,
      service_id: "svc-divorce",
      services: { title: "Розірвання шлюбу" },
    },
    profiles: null,
    ...overrides,
  } as OrderQueryRow;
}

describe("toReviewer", () => {
  it("is none when no reviewer is recorded", () => {
    expect(toReviewer({ reviewer_id: null, profiles: null })).toEqual({ kind: "none" });
  });

  it("is unnamed when a reviewer is recorded and the profile is hidden", () => {
    // The case the whole three-state model exists for. PostgREST returns null
    // for an embed RLS filtered out — the same null it returns when there was
    // never a row — so reading the embed alone would call this "none" and tell
    // a lawyer the matter is unclaimed.
    expect(toReviewer({ reviewer_id: "usr-hidden", profiles: null })).toEqual({
      kind: "unnamed",
      id: "usr-hidden",
    });
  });

  it("is unnamed when the profile is readable but has no name", () => {
    // A different cause, the same thing the reader can do about it. `full_name`
    // is nullable, so this is reachable without RLS being involved at all.
    expect(
      toReviewer({ reviewer_id: "usr-blank", profiles: { id: "usr-blank", full_name: null } }),
    ).toEqual({ kind: "unnamed", id: "usr-blank" });
  });

  it("is a person when the profile is readable and named", () => {
    expect(
      toReviewer({ reviewer_id: "usr-olena", profiles: { id: "usr-olena", full_name: "Олена" } }),
    ).toEqual({ kind: "person", id: "usr-olena", fullName: "Олена" });
  });
});

describe("toOrderListItem", () => {
  it("takes the version and the service from the pinned version", () => {
    const item = toOrderListItem(row());

    expect(item.version).toBe(2);
    expect(item.serviceId).toBe("svc-divorce");
    expect(item.serviceTitle).toBe("Розірвання шлюбу");
  });

  it("shows the pseudonym rather than the client id", () => {
    expect(toOrderListItem(row()).clientPseudonym).toBe("client-4f2a91");
  });

  // The two cases below need a cast, and the cast is the finding rather than a
  // nuisance. `pnpm db:types` generates these embeds as non-nullable, because a
  // to-one embed across a `not null` foreign key cannot be missing — as a matter
  // of referential integrity, which is all the generator knows about.
  //
  // RLS is the thing it does not know about. PostgREST returns `null` for an
  // embedded row the reader may not see, whatever the foreign key says, and
  // `clients_select_staff` is a policy a future migration could narrow. So the
  // fallbacks in the mapping are not dead code guarding an impossible state;
  // they guard a state the *type system has no way to express*, which is
  // exactly the kind that ships.
  const hidden = (over: Record<string, null>) =>
    ({ ...row(), ...over }) as unknown as OrderQueryRow;

  it("falls back to the client id rather than rendering nothing", () => {
    // Asserted because the console has no ErrorBoundary (DoD §5): the fallback
    // has to be visibly odd text, not a throw and not a blank cell that reads
    // as "no client".
    const item = toOrderListItem(hidden({ clients: null }));

    expect(item.clientPseudonym).toBe("cli-1");
  });

  it("survives a hidden version without taking the screen down", () => {
    const item = toOrderListItem(hidden({ service_versions: null }));

    expect(item.version).toBe(0);
    expect(item.serviceId).toBe("");
    expect(item.serviceTitle).toBe("");
  });

  it("carries the Art. 22 flag through unchanged", () => {
    expect(toOrderListItem(row({ human_review_requested: true })).humanReviewRequested).toBe(true);
  });
});

describe("supabaseOrdersApi.list", () => {
  it("asks for one row past the limit, so 'there is more' is data and not a guess", async () => {
    result.data = [];

    await supabaseOrdersApi.list(50);

    expect(calls.limit).toEqual([[51]]);
  });

  it("orders by placed_at and then by id, because a tie is otherwise the planner's", async () => {
    // Several orders written by one statement share `placed_at` to the
    // microsecond. Ordering by it alone lets them reshuffle between loads, and
    // a queue that reorders itself is not a queue. Neither ordering shows up in
    // the rows, which is why this is asserted on the call.
    await supabaseOrdersApi.list(50);

    expect(calls.order).toEqual([
      ["placed_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("drops the extra row rather than showing it", async () => {
    result.data = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];

    const page = await supabaseOrdersApi.list(2);

    expect(page.orders.map((order) => order.id)).toEqual(["a", "b"]);
    expect(page.hasMore).toBe(true);
  });

  it("reports no more when the answer fits", async () => {
    result.data = [row({ id: "a" })];

    const page = await supabaseOrdersApi.list(2);

    expect(page.hasMore).toBe(false);
  });

  it("turns a failure into an AppError rather than letting Postgrest through", async () => {
    // ADR-0012, convention 4: no Supabase type crosses the boundary. A screen
    // that received a `PostgrestError` here would render its message, which is
    // English developer text no dictionary can reach (DoD §6).
    result.error = { message: "boom", code: "42501", details: "", hint: "" };

    await expect(supabaseOrdersApi.list(50)).rejects.toThrowError();
  });
});
