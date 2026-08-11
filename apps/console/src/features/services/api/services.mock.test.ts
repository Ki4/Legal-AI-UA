import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "../../../shared/api/errors";
import {
  serviceAssignmentRows,
  serviceRows,
  serviceVersionPriceRows,
  serviceVersionRows,
} from "../../../shared/api/fixture-store";
import { mockServicesApi } from "./services.mock";

// The fixture store is module state, so anything that mutates it puts it back.
// Vitest isolates test files from each other; within a file, order is ours to
// keep honest.
const originalVersions = serviceVersionRows.map((row) => ({ ...row }));
const originalServices = serviceRows.map((row) => ({ ...row }));
const originalPrices = serviceVersionPriceRows.map((row) => ({ ...row }));
const originalAssignments = serviceAssignmentRows.map((row) => ({ ...row }));

afterEach(() => {
  serviceVersionRows.length = 0;
  serviceVersionRows.push(...originalVersions.map((row) => ({ ...row })));
  serviceRows.length = 0;
  serviceRows.push(...originalServices.map((row) => ({ ...row })));
  serviceVersionPriceRows.length = 0;
  serviceVersionPriceRows.push(...originalPrices.map((row) => ({ ...row })));
  serviceAssignmentRows.length = 0;
  serviceAssignmentRows.push(...originalAssignments.map((row) => ({ ...row })));
});

describe("list", () => {
  it("returns every service", async () => {
    expect(await mockServicesApi.list()).toHaveLength(3);
  });

  it("shows the live version, not an archived predecessor", async () => {
    const divorce = (await mockServicesApi.list()).find((s) => s.id === "svc-divorce");
    expect(divorce?.currentVersion?.version).toBe(2);
    expect(divorce?.currentVersion?.status).toBe("published");
  });

  it("falls back to the newest version when nothing was ever published", async () => {
    const alimony = (await mockServicesApi.list()).find((s) => s.id === "svc-alimony");
    expect(alimony?.currentVersion?.status).toBe("draft");
  });

  it("treats paused as live — it is still the version on the catalogue", async () => {
    const poa = (await mockServicesApi.list()).find((s) => s.id === "svc-poa");
    expect(poa?.currentVersion?.status).toBe("paused");
  });

  it("joins the assigned lawyer's name", async () => {
    const divorce = (await mockServicesApi.list()).find((s) => s.id === "svc-divorce");
    expect(divorce?.primaryLawyer?.fullName).toBe("Olena Kovalchuk");
  });

  it("returns null for a service nobody is assigned to", async () => {
    const poa = (await mockServicesApi.list()).find((s) => s.id === "svc-poa");
    expect(poa?.primaryLawyer).toBeNull();
  });

  it("orders by most recently updated", async () => {
    const all = await mockServicesApi.list();
    const timestamps = all.map((item) => item.updatedAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });
});

describe("list filters", () => {
  it("narrows by status", async () => {
    expect(await mockServicesApi.list({ status: ["published"] })).toHaveLength(1);
  });

  it("matches the query case-insensitively against title and slug", async () => {
    expect(await mockServicesApi.list({ query: "ALIMONY" })).toHaveLength(1);
    expect(await mockServicesApi.list({ query: "power-of" })).toHaveLength(1);
  });

  it("narrows by lawyer, cover included", async () => {
    // Taras is accountable for alimony and covers divorce. Both are his work:
    // a filter that returned only what he is accountable for would hide the
    // service he was brought in to look after (spec §14, Q18).
    const result = await mockServicesApi.list({ lawyerId: "usr-taras" });
    expect(result.map((s) => s.id).sort()).toEqual(["svc-alimony", "svc-divorce"]);
  });

  it("does not confuse cover with accountability", async () => {
    const divorce = (await mockServicesApi.list({ lawyerId: "usr-taras" })).find(
      (s) => s.id === "svc-divorce",
    );
    expect(divorce?.primaryLawyer?.id).toBe("usr-olena");
    expect(divorce?.coverLawyers.map((l) => l.id)).toEqual(["usr-taras"]);
  });

  it("treats a blank query as no filter", async () => {
    expect(await mockServicesApi.list({ query: "   " })).toHaveLength(3);
  });
});

describe("get", () => {
  it("throws not_found for an unknown id", async () => {
    await expect(mockServicesApi.get("svc-nope")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(mockServicesApi.get("svc-nope")).rejects.toBeInstanceOf(AppError);
  });
});

describe("assignLawyer", () => {
  it("returns the updated entity so the caller need not refetch", async () => {
    const updated = await mockServicesApi.setPrimaryLawyer("svc-poa", "usr-taras");
    expect(updated.primaryLawyer?.fullName).toBe("Taras Bondarenko");
  });

  it("makes the write visible to the next read", async () => {
    await mockServicesApi.setPrimaryLawyer("svc-poa", "usr-taras");
    expect((await mockServicesApi.get("svc-poa")).primaryLawyer?.id).toBe("usr-taras");
  });

  it("unassigns when given null", async () => {
    await mockServicesApi.setPrimaryLawyer("svc-divorce", null);
    const after = await mockServicesApi.get("svc-divorce");
    expect(after.primaryLawyer).toBeNull();
    // Demoted, not detached: losing accountability is not losing access.
    expect(after.coverLawyers.map((l) => l.id)).toContain("usr-olena");
  });

  it("rejects an unknown profile", async () => {
    await expect(mockServicesApi.setPrimaryLawyer("svc-poa", "usr-ghost")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("throws not_found for an unknown service", async () => {
    await expect(mockServicesApi.setPrimaryLawyer("svc-nope", null)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("a lawyer who is assigned but unreadable", () => {
  it("is not reported as unassigned", async () => {
    // Deleted, or hidden from this user by RLS. Collapsing this into "nobody
    // assigned" makes the layer state a falsehood about who is responsible.
    serviceAssignmentRows.push({
      service_id: "svc-poa",
      lawyer_id: "usr-hidden",
      is_primary: true,
      assigned_at: "2026-08-01T00:00:00.000Z",
      assigned_by: null,
    });

    const poa = (await mockServicesApi.list()).find((s) => s.id === "svc-poa");
    expect(poa?.primaryLawyer).not.toBeNull();
    expect(poa?.primaryLawyer?.id).toBe("usr-hidden");
    expect(poa?.primaryLawyer?.fullName).toBeNull();
  });
});

describe("price", () => {
  it("reads the display currency out of the price table", async () => {
    const divorce = (await mockServicesApi.list()).find((s) => s.id === "svc-divorce");
    expect(divorce?.currentVersion?.priceMinor).toBe(520000);
    expect(divorce?.currentVersion?.currency).toBe("UAH");
  });

  it("reports no price rather than a zero when a version has none", async () => {
    // An unpriced draft is an ordinary state, and 0 UAH is a different claim
    // from "not priced yet" — one of them says the document is free.
    const alimony = (await mockServicesApi.list()).find((s) => s.id === "svc-alimony");
    expect(alimony?.currentVersion?.version).toBe(1);
    expect(alimony?.currentVersion?.priceMinor).toBeNull();
    expect(alimony?.currentVersion?.currency).toBeNull();
  });

  it("ignores a price in a currency the screen does not display", async () => {
    // Prices are per currency (spec §8.6). A EUR row must not be picked up and
    // rendered as if it were the hryvnia price.
    serviceVersionPriceRows.push({
      service_version_id: "sv-alimony-1",
      currency: "EUR",
      amount_minor: 13000,
    });

    const alimony = (await mockServicesApi.list()).find((s) => s.id === "svc-alimony");
    expect(alimony?.currentVersion?.priceMinor).toBeNull();
  });
});

describe("choosing the current version", () => {
  it("takes the highest live version regardless of row order", async () => {
    // The schema now guarantees one live version per service — the partial
    // unique index covers `published` and `paused` together. This still has to
    // hold, because no query promises an order: a Supabase result arrives in
    // whatever order the planner produced, and picking "the first live row"
    // would be right only by luck.
    serviceVersionRows.push({
      id: "sv-divorce-3",
      service_id: "svc-divorce",
      version: 3,
      status: "paused",
      generation_mode: "full_generation",
      review_mode: "lawyer_required",
      published_at: "2026-08-01T00:00:00.000Z",
      published_by: "usr-admin",
      created_at: "2026-07-31T00:00:00.000Z",
    });

    const forwards = (await mockServicesApi.get("svc-divorce")).currentVersion?.version;
    serviceVersionRows.reverse();
    const backwards = (await mockServicesApi.get("svc-divorce")).currentVersion?.version;

    expect(forwards).toBe(3);
    expect(backwards).toBe(3);
  });

  it("returns null for a service with no versions at all", async () => {
    serviceVersionRows.length = 0;
    expect((await mockServicesApi.get("svc-divorce")).currentVersion).toBeNull();
  });
});
