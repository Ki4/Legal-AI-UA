// Every contract operation, including the refusals — a fixture that only knows
// how to succeed builds screens that have never seen one (DoD §8). The rules
// asserted here are the schema's: the release RPC's order of refusals, the
// publish trigger's three conditions, the pause guard's two, and the way the
// version's status follows the pause row.
//
// The store is shared and mutable, so every test that writes restores what it
// touched. Vitest isolates files, not tests within one.

import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "../../../shared/api/errors";
import {
  servicePauseRows,
  serviceRows,
  serviceVersionRows,
} from "../../../shared/api/fixture-store";
import {
  FIXTURE_ADMIN,
  FIXTURE_CALLER,
  mockServiceVersionsApi as api,
} from "./service-versions.mock";

function snapshot() {
  return {
    versions: serviceVersionRows.map((row) => ({ ...row })),
    pauses: servicePauseRows.map((row) => ({ ...row })),
  };
}

function restore(saved: ReturnType<typeof snapshot>) {
  serviceVersionRows.splice(0, serviceVersionRows.length, ...saved.versions);
  servicePauseRows.splice(0, servicePauseRows.length, ...saved.pauses);
}

/**
 * `sv-alimony-1` is the fixture caller's own draft in an area where somebody
 * else also signs — the one case the four-eyes rule refuses. Tests that need a
 * version the caller may sign hand the draft to Olena first.
 */
function authoredByOlena(versionId: string) {
  const row = serviceVersionRows.find((candidate) => candidate.id === versionId);
  if (row) row.created_by = "usr-olena";
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (cause) {
    return cause instanceof AppError ? cause.code : "not-an-AppError";
  }
}

describe("listForService", () => {
  it("returns every version newest first, with its three names", async () => {
    const page = await api.listForService("svc-divorce");

    expect(page.versions.map((v) => v.version)).toEqual([2, 1]);
    const [live, archived] = page.versions;
    expect(live?.author).toEqual({ id: "usr-olena", fullName: "Olena Kovalchuk" });
    expect(live?.release).toEqual({
      kind: "signed",
      by: { id: "usr-taras", fullName: "Taras Bondarenko" },
      at: "2026-07-29T11:10:00.000Z",
      selfReleased: false,
    });
    expect(live?.sale).toEqual({
      by: { id: "usr-admin", fullName: "Iryna Shevchenko" },
      at: "2026-07-30T14:05:00.000Z",
    });
    expect(archived?.status).toBe("archived");
  });

  it("carries the closed pause on the predecessor, naming the version that replaced it", async () => {
    const page = await api.listForService("svc-divorce");
    const archived = page.versions.find((v) => v.version === 1);

    expect(archived?.openPause).toBeNull();
    expect(archived?.pauses).toHaveLength(1);
    expect(archived?.pauses[0]?.outcome).toEqual({
      kind: "closed",
      at: "2026-07-30T14:05:00.000Z",
      by: { id: "usr-admin", fullName: "Iryna Shevchenko" },
      resolution: "new_version",
      replacedByVersion: 2,
    });
  });

  it("carries the open pause on a paused version, and the self-release flag", async () => {
    const page = await api.listForService("svc-poa");
    const [only] = page.versions;

    expect(only?.status).toBe("paused");
    expect(only?.openPause?.reason).toBe("defect");
    expect(only?.openPause?.outcome).toEqual({ kind: "open" });
    expect(only?.release).toMatchObject({ kind: "signed", selfReleased: true });
  });

  it("lists the area's signatories head first, and the assignments with the accountable flag", async () => {
    const page = await api.listForService("svc-divorce");

    expect(page.signatories.map((s) => [s.lawyer.id, s.isHead])).toEqual([
      ["usr-olena", true],
      ["usr-taras", false],
    ]);
    expect(page.assignments).toEqual([
      { lawyerId: "usr-olena", isPrimary: true },
      { lawyerId: "usr-taras", isPrimary: false },
    ]);
    expect(page.service.practiceArea?.labels.en).toBe("Family");
  });

  it("a service filed under an area nobody signs for lists no signatories", async () => {
    // Labour law has no signatory in the fixtures and no service; file one
    // there for the duration of the test.
    const service = serviceRows.find((row) => row.id === "svc-alimony");
    const area = service?.practice_area;
    if (service) service.practice_area = "labour";
    try {
      const page = await api.listForService("svc-alimony");
      expect(page.signatories).toEqual([]);
      expect(page.service.practiceArea?.code).toBe("labour");
    } finally {
      if (service && area !== undefined) service.practice_area = area;
    }
  });

  it("throws not_found for an unknown service", async () => {
    await expect(codeOf(api.listForService("svc-nope"))).resolves.toBe("not_found");
  });
});

describe("the author's act", () => {
  let saved: ReturnType<typeof snapshot>;
  afterEach(() => restore(saved));

  it("moves a draft to review and back, clearing a signature on the way back", async () => {
    saved = snapshot();
    authoredByOlena("sv-alimony-1");

    let page = await api.submitForReview("sv-alimony-1");
    expect(page.versions[0]?.status).toBe("in_review");

    // Sign it, then step back: the signature does not survive the reopening.
    page = await api.release("sv-alimony-1");
    expect(page.versions[0]?.release.kind).toBe("signed");

    page = await api.returnToDraft("sv-alimony-1");
    expect(page.versions[0]?.status).toBe("draft");
    expect(page.versions[0]?.release).toEqual({ kind: "none" });
  });

  it("refuses to move anything but a draft to review, or a sold version anywhere", async () => {
    saved = snapshot();
    await expect(codeOf(api.submitForReview("sv-divorce-2"))).resolves.toBe("validation");
    await expect(codeOf(api.returnToDraft("sv-divorce-2"))).resolves.toBe("validation");
    await expect(codeOf(api.returnToDraft("sv-alimony-1"))).resolves.toBe("validation");
  });
});

describe("release", () => {
  let saved: ReturnType<typeof snapshot>;
  afterEach(() => restore(saved));

  it("signs a version in review with the caller's name", async () => {
    saved = snapshot();
    authoredByOlena("sv-alimony-1");
    await api.submitForReview("sv-alimony-1");

    const page = await api.release("sv-alimony-1");
    const [only] = page.versions;
    expect(only?.release).toMatchObject({
      kind: "signed",
      by: { id: FIXTURE_CALLER },
      selfReleased: false,
    });
  });

  it("refuses a draft, a sold version, and a second signature", async () => {
    saved = snapshot();
    authoredByOlena("sv-alimony-1");
    await expect(codeOf(api.release("sv-alimony-1"))).resolves.toBe("validation");
    await expect(codeOf(api.release("sv-divorce-2"))).resolves.toBe("validation");

    await api.submitForReview("sv-alimony-1");
    await api.release("sv-alimony-1");
    await expect(codeOf(api.release("sv-alimony-1"))).resolves.toBe("validation");
  });

  it("refuses the author while the area has another signatory", async () => {
    saved = snapshot();
    // sv-alimony-1 is the caller's own draft in family law, where Olena also
    // signs. In review, it is exactly the version he may not release.
    const own = serviceVersionRows.find((row) => row.id === "sv-alimony-1");
    expect(own?.created_by).toBe(FIXTURE_CALLER);
    await api.submitForReview("sv-alimony-1");
    await expect(codeOf(api.release("sv-alimony-1"))).resolves.toBe("validation");
  });

  it("flags a self-release where the caller is the area's only signatory", async () => {
    saved = snapshot();
    // A fresh civil-law draft of Taras's, where he signs alone.
    serviceVersionRows.push({
      id: "sv-poa-2",
      service_id: "svc-poa",
      version: 2,
      status: "in_review",
      generation_mode: "template",
      review_mode: "auto",
      published_at: null,
      published_by: null,
      created_at: "2026-09-01T00:00:00.000Z",
      created_by: FIXTURE_CALLER,
      released_at: null,
      released_by: null,
      self_released: false,
    });

    const page = await api.release("sv-poa-2");
    expect(page.versions.find((v) => v.id === "sv-poa-2")?.release).toMatchObject({
      kind: "signed",
      selfReleased: true,
    });
  });

  it("throws not_found for an unknown version", async () => {
    saved = snapshot();
    await expect(codeOf(api.release("sv-nope"))).resolves.toBe("not_found");
  });
});

describe("putOnSale", () => {
  let saved: ReturnType<typeof snapshot>;
  afterEach(() => restore(saved));

  it("refuses an unreleased version", async () => {
    saved = snapshot();
    await api.submitForReview("sv-alimony-1");
    await expect(codeOf(api.putOnSale("sv-alimony-1"))).resolves.toBe("validation");
  });

  it("refuses a version already on sale", async () => {
    saved = snapshot();
    await expect(codeOf(api.putOnSale("sv-divorce-2"))).resolves.toBe("validation");
  });

  it("sells a released version, archives the live predecessor and closes its pause naming the fix", async () => {
    saved = snapshot();
    // A fix for the paused power of attorney: authored, reviewed, signed.
    serviceVersionRows.push({
      id: "sv-poa-2",
      service_id: "svc-poa",
      version: 2,
      status: "in_review",
      generation_mode: "template",
      review_mode: "auto",
      published_at: null,
      published_by: null,
      created_at: "2026-09-01T00:00:00.000Z",
      created_by: "usr-olena",
      released_at: "2026-09-02T00:00:00.000Z",
      released_by: FIXTURE_CALLER,
      self_released: false,
    });
    // svc-poa has nobody accountable in the fixtures; the trigger refuses that.
    await expect(codeOf(api.putOnSale("sv-poa-2"))).resolves.toBe("validation");

    // Give it one, and the sale goes through.
    const { serviceAssignmentRows } = await import("../../../shared/api/fixture-store");
    serviceAssignmentRows.push({
      service_id: "svc-poa",
      lawyer_id: "usr-olena",
      is_primary: true,
      assigned_at: "2026-09-01T00:00:00.000Z",
      assigned_by: "usr-admin",
    });
    try {
      const page = await api.putOnSale("sv-poa-2");
      const fix = page.versions.find((v) => v.id === "sv-poa-2");
      const old = page.versions.find((v) => v.id === "sv-poa-1");

      expect(fix?.status).toBe("published");
      expect(fix?.sale?.by?.id).toBe(FIXTURE_ADMIN);
      expect(old?.status).toBe("archived");
      expect(old?.openPause).toBeNull();
      expect(old?.pauses[0]?.outcome).toMatchObject({
        kind: "closed",
        resolution: "new_version",
        replacedByVersion: 2,
      });
    } finally {
      serviceAssignmentRows.pop();
    }
  });
});

describe("pause and lift", () => {
  let saved: ReturnType<typeof snapshot>;
  afterEach(() => restore(saved));

  it("opens a pause on a version on sale and the status follows the row", async () => {
    saved = snapshot();
    const page = await api.pause("sv-divorce-2", { reason: "defect", note: "clause 3" });
    const live = page.versions.find((v) => v.id === "sv-divorce-2");

    expect(live?.status).toBe("paused");
    expect(live?.openPause).toMatchObject({
      reason: "defect",
      note: "clause 3",
      openedBy: { id: FIXTURE_CALLER },
      outcome: { kind: "open" },
    });
  });

  it("refuses a version that is not on sale, and a second open pause", async () => {
    saved = snapshot();
    await expect(codeOf(api.pause("sv-alimony-1", { reason: "defect", note: null }))).resolves.toBe(
      "validation",
    );
    await expect(codeOf(api.pause("sv-poa-1", { reason: "defect", note: null }))).resolves.toBe(
      "conflict",
    );
  });

  it("resumes: the same version goes back on sale", async () => {
    saved = snapshot();
    const page = await api.lift("pause-poa-1", "resumed");
    const only = page.versions.find((v) => v.id === "sv-poa-1");

    expect(only?.status).toBe("published");
    expect(only?.openPause).toBeNull();
    expect(only?.pauses[0]?.outcome).toMatchObject({ kind: "closed", resolution: "resumed" });
  });

  it("archives: the version is withdrawn", async () => {
    saved = snapshot();
    const page = await api.lift("pause-poa-1", "archived");
    expect(page.versions.find((v) => v.id === "sv-poa-1")?.status).toBe("archived");
  });

  it("refuses to touch a closed pause, and an unknown one", async () => {
    saved = snapshot();
    await expect(codeOf(api.lift("pause-divorce-1", "resumed"))).resolves.toBe("validation");
    await expect(codeOf(api.lift("pause-nope", "resumed"))).resolves.toBe("not_found");
  });
});
