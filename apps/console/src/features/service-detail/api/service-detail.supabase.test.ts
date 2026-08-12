// The live implementation's testable half.
//
// The query itself needs a running stack to mean anything and is verified by
// hand against the sandbox (see the PR description). What is tested here is the
// row → view model translation, because that is where the decisions are: which
// version the card reflects, which null means what, and what an absent price
// says. All of them are decidable from a row literal, and every one of them was
// got wrong at least once in the reference implementation.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  supabaseServiceDetailApi,
  toServiceDetail,
  type ServiceDetailQueryRow,
} from "./service-detail.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest. So the client is replaced here
// rather than configured — which is also why the reference implementation has
// no test of its own. `vi.hoisted` is what lets the factory below reach a
// variable declared in this file: `vi.mock` is lifted above the imports.
const stub = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
}));

vi.mock("../../../app/supabase", () => {
  // Every builder method returns the same object, so the call chain in the
  // implementation resolves regardless of the order it is written in.
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => chain,
    returns: () => Promise.resolve(stub.result),
  };
  return { supabase: { from: () => chain } };
});

beforeEach(() => {
  stub.result = { data: null, error: null };
});

function row(overrides: Partial<ServiceDetailQueryRow> = {}): ServiceDetailQueryRow {
  return {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "divorce-application",
    title: "Divorce application",
    summary: "Application to dissolve a marriage.",
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-11T09:00:00.000Z",
    service_assignments: [],
    service_versions: [],
    ...overrides,
  };
}

function version(
  over: Partial<ServiceDetailQueryRow["service_versions"][number]> = {},
): ServiceDetailQueryRow["service_versions"][number] {
  return {
    id: "30000000-0000-0000-0000-000000000001",
    version: 1,
    status: "draft",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: null,
    service_version_prices: [],
    ...over,
  };
}

describe("toServiceDetail", () => {
  it("carries the fields the card needs and the list row does not", () => {
    const detail = toServiceDetail(row());
    expect(detail.summary).toBe("Application to dissolve a marriage.");
    expect(detail.createdAt).toBe("2026-08-01T09:00:00.000Z");
    expect(detail.updatedAt).toBe("2026-08-11T09:00:00.000Z");
  });

  describe("which version the card reflects", () => {
    it("prefers the live version over a higher-numbered draft", () => {
      // The case that makes "newest" wrong on its own: work on v2 is in
      // progress while v1 is what clients are actually being served.
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({
              id: "v1",
              version: 1,
              status: "published",
              published_at: "2026-08-05T00:00:00.000Z",
            }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.version).toBe(1);
      expect(detail.currentVersion?.publishedAt).toBe("2026-08-05T00:00:00.000Z");
    });

    it("counts a paused version as live", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ id: "v1", version: 1, status: "paused" }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.status).toBe("paused");
    });

    it("falls back to the newest when nothing is live", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ id: "v1", version: 1, status: "archived" }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.version).toBe(2);
    });

    it("does not depend on the order the rows arrive in", () => {
      // PostgREST embeds carry no ordering guarantee. Reversing the array must
      // change nothing (DoD §5).
      const versions = [
        version({ id: "v1", version: 1, status: "published" }),
        version({ id: "v2", version: 2, status: "draft" }),
        version({ id: "v3", version: 3, status: "draft" }),
      ];
      const forward = toServiceDetail(row({ service_versions: versions }));
      const reversed = toServiceDetail(row({ service_versions: [...versions].reverse() }));
      expect(reversed.currentVersion).toEqual(forward.currentVersion);
    });

    it("is null when the service has no versions at all", () => {
      expect(toServiceDetail(row()).currentVersion).toBeNull();
    });
  });

  describe("price", () => {
    it("reads the display currency", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ service_version_prices: [{ currency: "UAH", amount_minor: 520000 }] }),
          ],
        }),
      );
      expect(detail.currentVersion?.priceMinor).toBe(520000);
      expect(detail.currentVersion?.currency).toBe("UAH");
    });

    it("reports an unpriced version as null, never as zero", () => {
      // Zero would render as "0.00 UAH" — the card would tell a lawyer the
      // document is free when in fact nobody has priced it yet.
      const detail = toServiceDetail(row({ service_versions: [version()] }));
      expect(detail.currentVersion?.priceMinor).toBeNull();
      expect(detail.currentVersion?.currency).toBeNull();
    });

    it("ignores a price in another currency rather than showing its amount", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ service_version_prices: [{ currency: "EUR", amount_minor: 9900 }] }),
          ],
        }),
      );
      expect(detail.currentVersion?.priceMinor).toBeNull();
    });
  });

  describe("who answers for the service", () => {
    it("reports nobody assigned as two nulls", () => {
      const detail = toServiceDetail(row());
      expect(detail.assignedLawyerId).toBeNull();
      expect(detail.assignedLawyerName).toBeNull();
    });

    it("keeps assigned-but-unreadable apart from unassigned", () => {
      // The profile embed comes back null when RLS hides the row or the account
      // is deactivated. The id is still there, and the card must not claim the
      // service has nobody responsible for it.
      const detail = toServiceDetail(
        row({
          service_assignments: [{ lawyer_id: "usr-hidden", is_primary: true, profiles: null }],
        }),
      );
      expect(detail.assignedLawyerId).toBe("usr-hidden");
      expect(detail.assignedLawyerName).toBeNull();
    });

    it("names the accountable lawyer, not a cover lawyer", () => {
      const detail = toServiceDetail(
        row({
          service_assignments: [
            {
              lawyer_id: "usr-taras",
              is_primary: false,
              profiles: { id: "usr-taras", full_name: "Taras Bondarenko" },
            },
            {
              lawyer_id: "usr-olena",
              is_primary: true,
              profiles: { id: "usr-olena", full_name: "Olena Kovalchuk" },
            },
          ],
        }),
      );
      expect(detail.assignedLawyerName).toBe("Olena Kovalchuk");
    });

    it("treats cover without an accountable lawyer as unassigned", () => {
      // The schema permits it: the partial unique index caps the accountable
      // lawyer at one, it does not require one. Reading the sole cover lawyer
      // as accountable would put a name against an obligation nobody holds.
      const detail = toServiceDetail(
        row({
          service_assignments: [
            {
              lawyer_id: "usr-taras",
              is_primary: false,
              profiles: { id: "usr-taras", full_name: "Taras Bondarenko" },
            },
          ],
        }),
      );
      expect(detail.assignedLawyerId).toBeNull();
    });
  });
});

describe("get", () => {
  // The contract operation itself. This covers the branches the mapping tests
  // cannot reach: a PostgREST error, and the empty result that has to become
  // not_found rather than a null card.

  it("maps a row to the view model", async () => {
    stub.result = { data: row({ title: "Alimony claim" }), error: null };
    expect((await supabaseServiceDetailApi.get("any")).title).toBe("Alimony claim");
  });

  it("turns an empty result into not_found", async () => {
    // `maybeSingle` returns null with no error when RLS filters the row out.
    // Passing that through as a null card would render "no versions yet"
    // against a service the caller simply may not be allowed to see.
    stub.result = { data: null, error: null };
    await expect(supabaseServiceDetailApi.get("missing")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("translates a PostgREST error instead of leaking it", async () => {
    stub.result = {
      data: null,
      error: { code: "42501", message: "permission denied", details: "", hint: "" },
    };
    await expect(supabaseServiceDetailApi.get("forbidden")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
