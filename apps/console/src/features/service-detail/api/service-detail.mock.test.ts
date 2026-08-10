import { afterEach, describe, expect, it } from "vitest";
import { mockServicesApi } from "../../services/api/services.mock";
import { serviceRows } from "../../../shared/api/fixture-store";
import { mockServiceDetailApi } from "./service-detail.mock";

// Reaching into a sibling feature is forbidden in application code and
// deliberate here: the point of these two cases is that both features see one
// set of rows, which cannot be shown from inside either one alone.
const originalServices = serviceRows.map((row) => ({ ...row }));

afterEach(() => {
  serviceRows.length = 0;
  serviceRows.push(...originalServices.map((row) => ({ ...row })));
});

describe("get", () => {
  it("returns the card's own view model, including summary and timestamps", async () => {
    const detail = await mockServiceDetailApi.get("svc-divorce");
    expect(detail.title).toBe("Divorce application");
    expect(detail.summary).not.toBeNull();
    expect(detail.currentVersion?.version).toBe(2);
    expect(detail.assignedLawyerName).toBe("Olena Kovalchuk");
  });

  it("throws not_found for an unknown id", async () => {
    await expect(mockServiceDetailApi.get("svc-nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("distinguishes unassigned from assigned-but-unreadable", async () => {
    const unassigned = await mockServiceDetailApi.get("svc-poa");
    expect(unassigned.assignedLawyerId).toBeNull();
    expect(unassigned.assignedLawyerName).toBeNull();

    serviceRows.find((s) => s.id === "svc-poa")!.assignedLawyerId = "usr-hidden";
    const hidden = await mockServiceDetailApi.get("svc-poa");
    expect(hidden.assignedLawyerId).toBe("usr-hidden");
    expect(hidden.assignedLawyerName).toBeNull();
  });
});

describe("one store behind both features", () => {
  it("sees a write made through the services feature", async () => {
    // Private per-feature copies would make this pass locally and fail in
    // reality — the fixture divergence ADR-0012 exists to prevent.
    await mockServicesApi.assignLawyer("svc-poa", "usr-taras");
    expect((await mockServiceDetailApi.get("svc-poa")).assignedLawyerName).toBe("Taras Bondarenko");
  });
});
