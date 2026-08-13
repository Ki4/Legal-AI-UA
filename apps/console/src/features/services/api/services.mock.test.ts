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

describe("browse", () => {
  it("returns every service", async () => {
    expect((await mockServicesApi.browse()).items).toHaveLength(3);
  });

  it("shows the live version, not an archived predecessor", async () => {
    const divorce = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-divorce");
    expect(divorce?.currentVersion?.version).toBe(2);
    expect(divorce?.currentVersion?.status).toBe("published");
  });

  it("falls back to the newest version when nothing was ever published", async () => {
    const alimony = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-alimony");
    expect(alimony?.currentVersion?.status).toBe("draft");
  });

  it("treats paused as live — it is still the version on the catalogue", async () => {
    const poa = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-poa");
    expect(poa?.currentVersion?.status).toBe("paused");
  });

  it("joins the assigned lawyer's name", async () => {
    const divorce = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-divorce");
    expect(divorce?.primaryLawyer?.fullName).toBe("Olena Kovalchuk");
  });

  it("returns null for a service nobody is assigned to", async () => {
    const poa = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-poa");
    expect(poa?.primaryLawyer).toBeNull();
  });

  it("names the practice area rather than passing the code through", async () => {
    const divorce = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-divorce");
    expect(divorce?.practiceArea).toEqual({
      code: "family",
      // Both languages, because the label is reference data: an area an admin
      // adds tomorrow cannot be in a dictionary compiled today, so the layer
      // carries every label and the screen picks by locale.
      labels: { uk: "Сімейне право", en: "Family" },
      position: 10,
    });
  });

  it("renders an area it cannot resolve as its raw code, and sorts it last", async () => {
    // The column is not null and the embed should always resolve. "Should" is
    // not something a screen can be built on: an unresolved area must look odd
    // rather than take the catalogue down (DoD §5).
    serviceRows.push({
      id: "svc-orphan",
      slug: "orphan-area",
      title: "Filed under something unknown",
      summary: null,
      practice_area: "astrology",
      created_at: "2026-08-12T09:00:00.000Z",
      updated_at: "2026-08-12T09:00:00.000Z",
    });

    const items = (await mockServicesApi.browse()).items;
    expect(items.at(-1)?.practiceArea).toEqual({
      code: "astrology",
      // The raw code in every language. An unresolved area that read as a
      // plausible label in one of them would be a bug nobody reports.
      labels: { uk: "astrology", en: "astrology" },
      position: Number.MAX_SAFE_INTEGER,
    });
  });

  it("orders by area, then title — never by whatever order the rows arrived in", async () => {
    // The grid groups by area, and a group that reshuffles between loads reads
    // as a change that did not happen (DoD §5).
    const items = (await mockServicesApi.browse()).items;
    expect(items.map((s) => s.id)).toEqual(["svc-alimony", "svc-divorce", "svc-poa"]);
  });
});

describe("facets", () => {
  it("counts each area over the whole matched set", async () => {
    const { areas } = await mockServicesApi.browse();
    expect(areas.map((f) => [f.area.code, f.count])).toEqual([
      ["family", 2],
      ["civil", 1],
    ]);
  });

  it("offers no value with nothing behind it", async () => {
    // `labour` is a seeded area no fixture service sits in. A chip that leads
    // to an empty screen teaches the reader that the screen is broken.
    const { areas } = await mockServicesApi.browse();
    expect(areas.map((f) => f.area.code)).not.toContain("labour");
  });

  it("keeps counting the areas the reader filtered out", async () => {
    // This is what lets the screen say "nothing here, 2 matches elsewhere"
    // instead of rendering a blank result.
    const { items, areas } = await mockServicesApi.browse({ areas: ["civil"] });
    expect(items).toHaveLength(1);
    expect(areas.find((f) => f.area.code === "family")?.count).toBe(2);
  });

  it("counts statuses, and leaves a version-less service out of all of them", async () => {
    const { statuses } = await mockServicesApi.browse();
    expect(statuses.map((f) => f.status).sort()).toEqual(["draft", "paused", "published"]);
  });

  it("reports what matched before the facets narrowed it", async () => {
    // Zero items with a positive total is "your filters did this"; zero and
    // zero is "there is nothing here". The screen renders them differently.
    const result = await mockServicesApi.browse({ areas: ["family"], status: ["archived"] });
    expect(result.items).toHaveLength(0);
    expect(result.matchedBeforeFacets).toBe(3);
  });
});

describe("browse filters", () => {
  it("narrows by status", async () => {
    expect((await mockServicesApi.browse({ status: ["published"] })).items).toHaveLength(1);
  });

  it("narrows by area, and by several at once", async () => {
    expect((await mockServicesApi.browse({ areas: ["family"] })).items).toHaveLength(2);
    expect((await mockServicesApi.browse({ areas: ["family", "civil"] })).items).toHaveLength(3);
  });

  it("matches the query case-insensitively against title, slug and summary", async () => {
    expect((await mockServicesApi.browse({ query: "ALIMONY" })).items).toHaveLength(1);
    expect((await mockServicesApi.browse({ query: "power-of" })).items).toHaveLength(1);
    expect((await mockServicesApi.browse({ query: "district court" })).items).toHaveLength(1);
  });

  it("narrows by lawyer, cover included", async () => {
    // Taras is accountable for alimony and covers divorce. Both are his work:
    // a filter that returned only what he is accountable for would hide the
    // service he was brought in to look after (spec §14, Q18).
    const result = await mockServicesApi.browse({ lawyerId: "usr-taras" });
    expect(result.items.map((s) => s.id).sort()).toEqual(["svc-alimony", "svc-divorce"]);
  });

  it("counts facets over the lawyer's services only, not the whole catalogue", async () => {
    const { areas, matchedBeforeFacets } = await mockServicesApi.browse({ lawyerId: "usr-taras" });
    expect(matchedBeforeFacets).toBe(2);
    expect(areas.map((f) => f.area.code)).toEqual(["family"]);
  });

  it("does not confuse cover with accountability", async () => {
    const divorce = (await mockServicesApi.browse({ lawyerId: "usr-taras" })).items.find(
      (s) => s.id === "svc-divorce",
    );
    expect(divorce?.primaryLawyer?.id).toBe("usr-olena");
    expect(divorce?.coverLawyers.map((l) => l.id)).toEqual(["usr-taras"]);
  });

  it("treats a blank query as no filter", async () => {
    expect((await mockServicesApi.browse({ query: "   " })).items).toHaveLength(3);
  });

  it('treats an empty filter array as no filter, not as "match nothing"', async () => {
    expect((await mockServicesApi.browse({ areas: [], status: [] })).items).toHaveLength(3);
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

// The `setPrimaryLawyer` cases moved with the operation itself, to
// `features/service-detail/api/service-detail.mock.test.ts` (ADM-10).

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

    const poa = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-poa");
    expect(poa?.primaryLawyer).not.toBeNull();
    expect(poa?.primaryLawyer?.id).toBe("usr-hidden");
    expect(poa?.primaryLawyer?.fullName).toBeNull();
  });
});

describe("price", () => {
  it("reads the display currency out of the price table", async () => {
    const divorce = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-divorce");
    expect(divorce?.currentVersion?.priceMinor).toBe(520000);
    expect(divorce?.currentVersion?.currency).toBe("UAH");
  });

  it("reports no price rather than a zero when a version has none", async () => {
    // An unpriced draft is an ordinary state, and 0 UAH is a different claim
    // from "not priced yet" — one of them says the document is free.
    const alimony = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-alimony");
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

    const alimony = (await mockServicesApi.browse()).items.find((s) => s.id === "svc-alimony");
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
