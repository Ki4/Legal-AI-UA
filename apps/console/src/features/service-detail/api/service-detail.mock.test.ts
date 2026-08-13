import { afterEach, describe, expect, it } from "vitest";
import { mockServicesApi } from "../../services/api/services.mock";
import { serviceAssignmentRows, serviceRows } from "../../../shared/api/fixture-store";
import { mockServiceDetailApi } from "./service-detail.mock";

// Reaching into a sibling feature is forbidden in application code and
// deliberate here: the point of the last case is that both features see one set
// of rows, which cannot be shown from inside either one alone.

// The fixture store is module state, so anything that mutates it puts it back.
// Vitest isolates test files from each other; within a file, order is ours to
// keep honest — and these tests write to `service_assignments` constantly.
const originalServices = serviceRows.map((row) => ({ ...row }));
const originalAssignments = serviceAssignmentRows.map((row) => ({ ...row }));

afterEach(() => {
  serviceRows.length = 0;
  serviceRows.push(...originalServices.map((row) => ({ ...row })));
  serviceAssignmentRows.length = 0;
  serviceAssignmentRows.push(...originalAssignments.map((row) => ({ ...row })));
});

describe("get", () => {
  it("returns the card's own view model, including summary and timestamps", async () => {
    const detail = await mockServiceDetailApi.get("svc-divorce");
    expect(detail.title).toBe("Divorce application");
    expect(detail.summary).not.toBeNull();
    expect(detail.currentVersion?.version).toBe(2);
    expect(detail.primaryLawyer?.fullName).toBe("Olena Kovalchuk");
  });

  it("keeps cover separate from the accountable lawyer", async () => {
    // Same rights, different obligation (spec §13). One list would state that
    // the two are the same thing.
    const detail = await mockServiceDetailApi.get("svc-divorce");
    expect(detail.primaryLawyer?.id).toBe("usr-olena");
    expect(detail.coverLawyers.map((lawyer) => lawyer.id)).toEqual(["usr-taras"]);
  });

  it("throws not_found for an unknown id", async () => {
    await expect(mockServiceDetailApi.get("svc-nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("distinguishes unassigned from assigned-but-unreadable", async () => {
    const unassigned = await mockServiceDetailApi.get("svc-poa");
    expect(unassigned.primaryLawyer).toBeNull();

    serviceAssignmentRows.push({
      service_id: "svc-poa",
      lawyer_id: "usr-hidden",
      is_primary: true,
      assigned_at: "2026-08-01T00:00:00.000Z",
      assigned_by: null,
    });
    const hidden = await mockServiceDetailApi.get("svc-poa");
    expect(hidden.primaryLawyer?.id).toBe("usr-hidden");
    expect(hidden.primaryLawyer?.fullName).toBeNull();
  });

  it("orders cover by name, with unreadable profiles last", async () => {
    // Array order out of a fixture is as meaningless as out of PostgREST, so
    // the layer decides it rather than inheriting it (DoD §5).
    serviceAssignmentRows.push(
      {
        service_id: "svc-poa",
        lawyer_id: "usr-hidden",
        is_primary: false,
        assigned_at: "2026-08-01T00:00:00.000Z",
        assigned_by: null,
      },
      {
        service_id: "svc-poa",
        lawyer_id: "usr-taras",
        is_primary: false,
        assigned_at: "2026-08-02T00:00:00.000Z",
        assigned_by: null,
      },
      {
        service_id: "svc-poa",
        lawyer_id: "usr-olena",
        is_primary: false,
        assigned_at: "2026-08-03T00:00:00.000Z",
        assigned_by: null,
      },
    );

    const detail = await mockServiceDetailApi.get("svc-poa");
    expect(detail.coverLawyers.map((lawyer) => lawyer.id)).toEqual([
      "usr-olena",
      "usr-taras",
      "usr-hidden",
    ]);
  });
});

describe("listAssignableLawyers", () => {
  it("returns lawyers by name, and no admins", async () => {
    // An admin is staff and readable, and still may not be made accountable for
    // a service (ADR-0005, spec §4.3).
    const lawyers = await mockServiceDetailApi.listAssignableLawyers();
    expect(lawyers.map((lawyer) => lawyer.id)).toEqual(["usr-olena", "usr-taras"]);
    expect(lawyers[0]?.email).toBe("olena@example.test");
  });

  it("does not offer a registration nobody has approved", async () => {
    // The rule 20260811160000_service_assignments.sql states in SQL: somebody
    // who filled in a form is a stranger, not a colleague. It had no fixture to
    // demonstrate it until `usr-pending` existed, so the picker's behaviour
    // here was assumed rather than checked.
    const lawyers = await mockServiceDetailApi.listAssignableLawyers();

    expect(lawyers.some((lawyer) => lawyer.id === "usr-pending")).toBe(false);
  });
});

describe("setPrimaryLawyer", () => {
  it("returns the updated entity so the caller need not refetch", async () => {
    const updated = await mockServiceDetailApi.setPrimaryLawyer("svc-poa", "usr-taras");
    expect(updated.primaryLawyer?.fullName).toBe("Taras Bondarenko");
  });

  it("makes the write visible to the next read", async () => {
    await mockServiceDetailApi.setPrimaryLawyer("svc-poa", "usr-taras");
    expect((await mockServiceDetailApi.get("svc-poa")).primaryLawyer?.id).toBe("usr-taras");
  });

  it("demotes the previous holder to cover rather than detaching them", async () => {
    await mockServiceDetailApi.setPrimaryLawyer("svc-divorce", "usr-taras");
    const after = await mockServiceDetailApi.get("svc-divorce");
    expect(after.primaryLawyer?.id).toBe("usr-taras");
    // Losing accountability is not losing access.
    expect(after.coverLawyers.map((lawyer) => lawyer.id)).toContain("usr-olena");
  });

  it("leaves nobody accountable when given null", async () => {
    await mockServiceDetailApi.setPrimaryLawyer("svc-divorce", null);
    const after = await mockServiceDetailApi.get("svc-divorce");
    expect(after.primaryLawyer).toBeNull();
    expect(after.coverLawyers.map((lawyer) => lawyer.id)).toContain("usr-olena");
  });

  it("rejects an unknown profile", async () => {
    await expect(
      mockServiceDetailApi.setPrimaryLawyer("svc-poa", "usr-ghost"),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("throws not_found for an unknown service", async () => {
    await expect(mockServiceDetailApi.setPrimaryLawyer("svc-nope", null)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("addCover", () => {
  it("attaches a lawyer as cover and returns the updated card", async () => {
    const updated = await mockServiceDetailApi.addCover("svc-poa", "usr-olena");
    expect(updated.coverLawyers.map((lawyer) => lawyer.id)).toEqual(["usr-olena"]);
    expect(updated.primaryLawyer).toBeNull();
  });

  it("refuses a lawyer who is already attached, in either role", async () => {
    await expect(mockServiceDetailApi.addCover("svc-divorce", "usr-taras")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(mockServiceDetailApi.addCover("svc-divorce", "usr-olena")).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("rejects an unknown profile", async () => {
    await expect(mockServiceDetailApi.addCover("svc-poa", "usr-ghost")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("throws not_found for an unknown service", async () => {
    await expect(mockServiceDetailApi.addCover("svc-nope", "usr-olena")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("removeCover", () => {
  it("detaches a cover lawyer", async () => {
    const updated = await mockServiceDetailApi.removeCover("svc-divorce", "usr-taras");
    expect(updated.coverLawyers).toEqual([]);
    expect(updated.primaryLawyer?.id).toBe("usr-olena");
  });

  it("refuses to remove the accountable lawyer", async () => {
    // Accountability is moved, never dropped: a service left with nobody
    // answering for it is the state the whole table exists to prevent.
    await expect(
      mockServiceDetailApi.removeCover("svc-divorce", "usr-olena"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect((await mockServiceDetailApi.get("svc-divorce")).primaryLawyer?.id).toBe("usr-olena");
  });

  it("turns a deletion that matched nothing into an error, not a success", async () => {
    // This is the failure ADR-0012 is written around: RLS filters the row out,
    // the statement deletes nothing, and Postgres reports no error at all.
    await expect(
      mockServiceDetailApi.removeCover("svc-divorce", "usr-admin"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("one store behind both features", () => {
  it("shows the list a write made through the card", async () => {
    // Private per-feature copies would make this pass locally and fail in
    // reality — the fixture divergence ADR-0012 exists to prevent.
    await mockServiceDetailApi.addCover("svc-poa", "usr-taras");
    const fromList = await mockServicesApi.get("svc-poa");
    expect(fromList.coverLawyers.map((lawyer) => lawyer.id)).toEqual(["usr-taras"]);
  });
});
