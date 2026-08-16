// Every contract operation, exercised against the fixture implementation —
// including the refusals, which is where the interesting behaviour is (DoD §8).
//
// The fixture store is mutable for this feature, so anything this file writes it
// puts back. Vitest isolates files from each other and not within one.

import { afterEach, describe, expect, it } from "vitest";
import { lawNormRows, serviceLawRefRows } from "../../../shared/api/fixture-store";
import { mockLawApi } from "./law.mock";

const normsBefore = lawNormRows.map((row) => ({ ...row }));
const refsBefore = serviceLawRefRows.map((row) => ({ ...row }));

afterEach(() => {
  lawNormRows.length = 0;
  lawNormRows.push(...normsBefore.map((row) => ({ ...row })));
  serviceLawRefRows.length = 0;
  serviceLawRefRows.push(...refsBefore.map((row) => ({ ...row })));
});

/** Asserts a rejection by code rather than by message — the message is English prose. */
async function rejectsWith(code: string, run: () => Promise<unknown>) {
  await expect(run()).rejects.toMatchObject({ name: "AppError", code });
}

describe("listNorms", () => {
  it("returns the register sorted by act and article, not by fixture order", async () => {
    const norms = await mockLawApi.listNorms();

    expect(norms.map((norm) => norm.id)).toEqual([
      "norm-sk-105",
      "norm-sk-180",
      "norm-ck-act",
      "norm-cpc-116",
    ]);
  });

  // §9.3, which is the register's entire argument: one row, several services.
  it("lists every service resting on a shared norm against that one norm", async () => {
    const norms = await mockLawApi.listNorms();
    const shared = norms.find((norm) => norm.id === "norm-sk-105");

    expect(shared?.dependents.map((dependent) => dependent.serviceId).sort()).toEqual([
      "svc-alimony",
      "svc-divorce",
    ]);
  });

  it("derives freshness rather than reading a column", async () => {
    const norms = await mockLawApi.listNorms();

    // Verified in July on a daily cadence: nothing was detected and nobody has
    // looked since, which §9.10 says is an alarm rather than silence.
    expect(norms.find((norm) => norm.id === "norm-sk-180")?.freshness.kind).toBe("stale");
    // Entered, never fetched — and distinct from "checked and unchanged".
    expect(norms.find((norm) => norm.id === "norm-ck-act")?.freshness).toEqual({
      kind: "never_checked",
    });
  });

  it("carries the act-level exception with the reason that justifies it", async () => {
    const norms = await mockLawApi.listNorms();
    const act = norms.find((norm) => norm.id === "norm-ck-act");

    expect(act?.article).toBeNull();
    expect(act?.scope).toBe("act");
    expect(act?.actScopeReason).not.toBeNull();
  });
});

describe("listForService", () => {
  it("returns what one service rests on, with the sentence for each", async () => {
    const page = await mockLawApi.listForService("svc-divorce");

    expect(page.serviceTitle).toBe("Divorce application");
    expect(page.refs.map((ref) => ref.norm.id).sort()).toEqual(["norm-cpc-116", "norm-sk-105"]);
    expect(page.refs.every((ref) => ref.reliedOn.length > 0)).toBe(true);
  });

  // The empty state, and it is an ordinary answer rather than an error: every
  // service is in it until somebody enters the first reference.
  it("returns an empty list for a service that rests on nothing", async () => {
    const page = await mockLawApi.listForService("svc-poa");
    expect(page.refs).toEqual([]);
  });

  it("refuses a service that does not exist, distinctly from an empty one", async () => {
    await rejectsWith("not_found", () => mockLawApi.listForService("svc-nonexistent"));
  });
});

describe("addReference", () => {
  it("attaches to the norm already in the register rather than watching it twice", async () => {
    const before = lawNormRows.length;

    // svc-poa citing the article svc-divorce and svc-alimony already cite —
    // through a *different* URL shape, with a pinned revision, which is exactly
    // how a second entry for one norm would arrive in practice.
    const ref = await mockLawApi.addReference({
      serviceId: "svc-poa",
      url: "https://zakon2.rada.gov.ua/laws/show/2947-14/ed20220101#n800",
      actTitle: "Сімейний кодекс України",
      article: "ст. 105",
      actScopeReason: null,
      reliedOn: "The same article, cited by a third service.",
    });

    expect(ref.norm.id).toBe("norm-sk-105");
    expect(lawNormRows.length).toBe(before);
    expect(ref.norm.dependents).toHaveLength(3);
  });

  it("enters a norm the register does not hold yet", async () => {
    const ref = await mockLawApi.addReference({
      serviceId: "svc-poa",
      url: "https://zakon.rada.gov.ua/laws/show/435-15/ed20230101",
      actTitle: "Цивільний кодекс України",
      article: "244",
      actScopeReason: null,
      reliedOn: "Form requirements for a power of attorney.",
    });

    expect(ref.norm.article).toBe("244");
    // The pinned revision is resolved away (§9.2, §9.5.1) — what gets watched is
    // the text in force, and on the canonical host.
    expect(ref.norm.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/435-15");
    // The pasted URL survives for display, revision and all (§9.2).
    expect(ref.norm.sourceUrl).toContain("ed20230101");
    expect(ref.norm.state).toBe("unverified");
  });

  it("normalizes the article, so one norm is not entered under two spellings", async () => {
    const ref = await mockLawApi.addReference({
      serviceId: "svc-poa",
      url: "https://zakon.rada.gov.ua/laws/show/2947-14",
      actTitle: "Сімейний кодекс України",
      article: "стаття 75¹",
      actScopeReason: null,
      reliedOn: "An article written with a superscript.",
    });

    expect(ref.norm.article).toBe("75-1");
  });

  describe("refusals", () => {
    it("refuses a link from a source nobody watches", async () => {
      await rejectsWith("validation", () =>
        mockLawApi.addReference({
          serviceId: "svc-poa",
          url: "https://reyestr.court.gov.ua/Review/12345",
          actTitle: "A court decision",
          article: "1",
          actScopeReason: null,
          reliedOn: "Court practice.",
        }),
      );
    });

    it("refuses an article it cannot read as an article", async () => {
      await rejectsWith("validation", () =>
        mockLawApi.addReference({
          serviceId: "svc-poa",
          url: "https://zakon.rada.gov.ua/laws/show/2947-14",
          actTitle: "Сімейний кодекс України",
          article: "частина 3 статті 75",
          actScopeReason: null,
          reliedOn: "A part rather than an article.",
        }),
      );
    });

    // §9.4: act-level tracking is allowed and is never silent.
    it("refuses act-level tracking with no reason recorded", async () => {
      await rejectsWith("validation", () =>
        mockLawApi.addReference({
          serviceId: "svc-poa",
          url: "https://zakon.rada.gov.ua/laws/show/1618-15",
          actTitle: "Цивільний процесуальний кодекс України",
          article: null,
          actScopeReason: "   ",
          reliedOn: "The whole act.",
        }),
      );
    });

    it("accepts act-level tracking that carries one", async () => {
      const ref = await mockLawApi.addReference({
        serviceId: "svc-poa",
        url: "https://zakon.rada.gov.ua/laws/show/1618-15",
        actTitle: "Цивільний процесуальний кодекс України",
        article: null,
        actScopeReason: "The template leans on the act throughout; noise expected.",
        reliedOn: "Procedure generally.",
      });

      expect(ref.norm.scope).toBe("act");
      expect(ref.norm.article).toBeNull();
    });

    // §9.5.6, and the reason the column is `not null`.
    it("refuses a reference with nothing written on what it is relied on for", async () => {
      await rejectsWith("validation", () =>
        mockLawApi.addReference({
          serviceId: "svc-poa",
          url: "https://zakon.rada.gov.ua/laws/show/2947-14",
          actTitle: "Сімейний кодекс України",
          article: "105",
          actScopeReason: null,
          reliedOn: "   ",
        }),
      );
    });

    it("refuses recording the same norm on the same service twice", async () => {
      await rejectsWith("conflict", () =>
        mockLawApi.addReference({
          serviceId: "svc-divorce",
          url: "https://zakon.rada.gov.ua/laws/show/2947-14",
          actTitle: "Сімейний кодекс України",
          article: "105",
          actScopeReason: null,
          reliedOn: "The article this service already records.",
        }),
      );
    });
  });
});

describe("removeReference", () => {
  it("drops the dependency and leaves the norm in the register", async () => {
    const removed = await mockLawApi.removeReference("ref-divorce-105");

    expect(removed).toBe("ref-divorce-105");
    expect(lawNormRows.some((norm) => norm.id === "norm-sk-105")).toBe(true);

    const page = await mockLawApi.listForService("svc-divorce");
    expect(page.refs.map((ref) => ref.id)).toEqual(["ref-divorce-cpc"]);
  });

  // The shape an RLS `using` denial takes: nothing removed, no error from the
  // database, and `expectOne` turning that into something the screen can say.
  it("reports a removal that wrote nothing rather than reporting success", async () => {
    await rejectsWith("forbidden", () => mockLawApi.removeReference("ref-does-not-exist"));
  });
});

describe("setCadence", () => {
  it("changes the interval and returns the updated norm", async () => {
    const updated = await mockLawApi.setCadence({
      normId: "norm-sk-105",
      hours: 6,
      reason: "Amended twice during the reform.",
    });

    expect(updated.probeIntervalHours).toBe(6);
    expect(updated.intervalReason).toBe("Amended twice during the reform.");
  });

  // §9.8: the rationale for a non-default value is recorded.
  it("refuses a non-recommended interval with no reason", async () => {
    await rejectsWith("validation", () =>
      mockLawApi.setCadence({ normId: "norm-sk-105", hours: 6, reason: "   " }),
    );
  });

  it("accepts the recommendation without asking for one", async () => {
    const updated = await mockLawApi.setCadence({
      normId: "norm-sk-105",
      hours: 24,
      reason: null,
    });

    expect(updated.probeIntervalHours).toBe(24);
  });

  it("refuses an interval that is not a positive amount of time", async () => {
    await rejectsWith("validation", () =>
      mockLawApi.setCadence({ normId: "norm-sk-105", hours: 0, reason: "never" }),
    );
  });

  it("refuses a norm that is not in the register", async () => {
    await rejectsWith("not_found", () =>
      mockLawApi.setCadence({ normId: "norm-nope", hours: 24, reason: null }),
    );
  });
});
