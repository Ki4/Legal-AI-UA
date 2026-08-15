// Contract tests over the fixture implementation (DoD §8): every operation
// exercised, and the interesting cases rather than the happy path.
//
// What these can prove is the mapping and the paging. What they cannot is RLS —
// the fixture store has no policies — so the state a lawyer meets when none of
// the orders are theirs is asserted at the component, where the api is mocked.

import { describe, expect, it } from "vitest";
import { mockOrdersApi } from "./orders.mock";

// Not imported from the hook that defines it: `hooks/useOrders` reaches
// `../api`, whose index picks the Supabase implementation, which builds its
// client at import time and throws without env vars. A number here keeps this
// file a test of the contract rather than of the module graph.
const ALL = 50;

describe("mockOrdersApi.list", () => {
  it("returns the orders newest first", async () => {
    const { orders } = await mockOrdersApi.list(ALL);

    const placed = orders.map((order) => order.placedAt);
    expect(placed).toEqual([...placed].sort().reverse());
  });

  it("joins the pinned version's service, not the service's current version", async () => {
    const { orders } = await mockOrdersApi.list(ALL);
    const order = orders.find((candidate) => candidate.id === "ord-1");

    // `sv-divorce-2` is version 2 of svc-divorce. The service also has an
    // archived v1, so a mapping that walked to "the service's version" rather
    // than to the pinned one could pick either and would still look right on a
    // service with one version.
    expect(order?.serviceId).toBe("svc-divorce");
    expect(order?.version).toBe(2);
  });

  it("shows the client's pseudonym and never an id", async () => {
    const { orders } = await mockOrdersApi.list(ALL);

    for (const order of orders) {
      expect(order.clientPseudonym).toMatch(/^client-/);
    }
  });

  it("tells a reviewer nobody took from a reviewer this reader cannot see", async () => {
    const { orders } = await mockOrdersApi.list(ALL);
    const byId = new Map(orders.map((order) => [order.id, order]));

    // The distinction DoD §5 exists for. Collapsing these into one nullable
    // name would send a lawyer to pick up a matter a colleague is holding.
    expect(byId.get("ord-2")?.reviewer).toEqual({ kind: "none" });
    expect(byId.get("ord-3")?.reviewer).toEqual({ kind: "unnamed", id: "usr-departed" });
    expect(byId.get("ord-1")?.reviewer).toMatchObject({ kind: "person", id: "usr-olena" });
  });

  it("carries the Art. 22 request separately from the state", async () => {
    const { orders } = await mockOrdersApi.list(ALL);
    const order = orders.find((candidate) => candidate.id === "ord-4");

    // It does not replace the state; it changes what the state can become.
    expect(order?.status).toBe("generating");
    expect(order?.humanReviewRequested).toBe(true);
  });

  it("reports more when there are more, and does not return the extra row", async () => {
    const page = await mockOrdersApi.list(2);

    expect(page.orders).toHaveLength(2);
    expect(page.hasMore).toBe(true);
  });

  it("reports no more when the page holds everything", async () => {
    const page = await mockOrdersApi.list(ALL);

    expect(page.hasMore).toBe(false);
  });

  it("returns an empty page rather than throwing when nothing is asked for", async () => {
    const page = await mockOrdersApi.list(0);

    // A limit of zero is not a state the screen produces, and that is exactly
    // why it is asserted: the "one past the limit" arithmetic is the kind that
    // goes wrong at its edges and is never exercised in normal use.
    expect(page.orders).toEqual([]);
    expect(page.hasMore).toBe(true);
  });
});

describe("mockOrdersApi.hasAnyAssignment", () => {
  it("is true for a caller attached to a service", async () => {
    // The fixture caller is accountable for svc-divorce. The false branch is a
    // lawyer attached to nothing, which the fixture store cannot pretend to be
    // — it has no session — so the component test carries that half.
    await expect(mockOrdersApi.hasAnyAssignment()).resolves.toBe(true);
  });
});
