import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "../../../shared/api/errors";
import { serviceRows, serviceVersionRows } from "../../../shared/api/fixture-store";
import { mockServicesApi } from "./services.mock";

// The fixture store is module state, so anything that mutates it puts it back.
// Vitest isolates test files from each other; within a file, order is ours to
// keep honest.
const originalVersions = serviceVersionRows.map((row) => ({ ...row }));
const originalServices = serviceRows.map((row) => ({ ...row }));

afterEach(() => {
  serviceVersionRows.length = 0;
  serviceVersionRows.push(...originalVersions.map((row) => ({ ...row })));
  serviceRows.length = 0;
  serviceRows.push(...originalServices.map((row) => ({ ...row })));
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
    expect(divorce?.assignedLawyer?.fullName).toBe("Olena Kovalchuk");
  });

  it("returns null for a service nobody is assigned to", async () => {
    const poa = (await mockServicesApi.list()).find((s) => s.id === "svc-poa");
    expect(poa?.assignedLawyer).toBeNull();
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

  it("narrows by assigned lawyer", async () => {
    const result = await mockServicesApi.list({ lawyerId: "usr-taras" });
    expect(result.map((s) => s.id)).toEqual(["svc-alimony"]);
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
    const updated = await mockServicesApi.assignLawyer("svc-poa", "usr-taras");
    expect(updated.assignedLawyer?.fullName).toBe("Taras Bondarenko");
  });

  it("makes the write visible to the next read", async () => {
    await mockServicesApi.assignLawyer("svc-poa", "usr-taras");
    expect((await mockServicesApi.get("svc-poa")).assignedLawyer?.id).toBe("usr-taras");
  });

  it("unassigns when given null", async () => {
    await mockServicesApi.assignLawyer("svc-divorce", null);
    expect((await mockServicesApi.get("svc-divorce")).assignedLawyer).toBeNull();
  });

  it("rejects an unknown profile", async () => {
    await expect(mockServicesApi.assignLawyer("svc-poa", "usr-ghost")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("throws not_found for an unknown service", async () => {
    await expect(mockServicesApi.assignLawyer("svc-nope", null)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("a lawyer who is assigned but unreadable", () => {
  it("is not reported as unassigned", async () => {
    // Deleted, or hidden from this user by RLS. Collapsing this into "nobody
    // assigned" makes the layer state a falsehood about who is responsible.
    serviceRows.find((s) => s.id === "svc-poa")!.assignedLawyerId = "usr-hidden";

    const poa = (await mockServicesApi.list()).find((s) => s.id === "svc-poa");
    expect(poa?.assignedLawyer).not.toBeNull();
    expect(poa?.assignedLawyer?.id).toBe("usr-hidden");
    expect(poa?.assignedLawyer?.fullName).toBeNull();
  });
});

describe("choosing the current version", () => {
  it("takes the highest live version regardless of row order", async () => {
    // Only `published` is covered by the schema's partial unique index, so a
    // second `paused` row is reachable — and no query promises an order.
    serviceVersionRows.push({
      id: "sv-divorce-3",
      serviceId: "svc-divorce",
      version: 3,
      status: "paused",
      generationMode: "full_generation",
      reviewMode: "lawyer_required",
      priceMinor: 999900,
      currency: "UAH",
      publishedAt: "2026-08-01T00:00:00.000Z",
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
