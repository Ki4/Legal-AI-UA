// Every contract operation exercised against the fixture implementation,
// including the refusals — which is where the interesting behaviour is (DoD §8).
//
// The fixture store is mutable for this feature, so anything this file writes it
// puts back. Vitest isolates files from each other and not within one.

import { afterEach, describe, expect, it } from "vitest";
import { questionnaireFieldRows } from "../../../shared/api/fixture-store";
import { mockServiceFieldsApi } from "./service-fields.mock";
import type { NewQuestionnaireField } from "./types";

const before = questionnaireFieldRows.map((row) => ({ ...row }));

afterEach(() => {
  questionnaireFieldRows.length = 0;
  questionnaireFieldRows.push(...before.map((row) => ({ ...row })));
});

/** Asserts a rejection by code rather than by message — the message is English prose. */
async function rejectsWith(code: string, run: () => Promise<unknown>) {
  await expect(run()).rejects.toMatchObject({ name: "AppError", code });
}

function newField(overrides: Partial<NewQuestionnaireField> = {}): NewQuestionnaireField {
  return {
    serviceId: "svc-divorce",
    key: "separation_reason",
    label: "Reason for separation",
    helpText: null,
    type: "text",
    required: false,
    options: null,
    personalData: { kind: "none" },
    ...overrides,
  };
}

describe("listForService", () => {
  it("returns the dictionary in position order, not in fixture order", async () => {
    const page = await mockServiceFieldsApi.listForService("svc-divorce");

    expect(page.serviceTitle).toBe("Divorce application");
    expect(page.fields.map((field) => field.key)).toEqual([
      "applicant_name",
      "marriage_date",
      "court_region",
      "health_grounds",
    ]);
  });

  it("reads the three GDPR shapes off the columns", async () => {
    const page = await mockServiceFieldsApi.listForService("svc-divorce");
    const by = (key: string) => page.fields.find((field) => field.key === key)?.personalData;

    expect(by("marriage_date")).toEqual({ kind: "none" });
    expect(by("applicant_name")).toEqual({
      kind: "personal",
      basis: "contract",
      retentionDays: 1095,
    });
    expect(by("health_grounds")).toEqual({
      kind: "special",
      basis: "legitimate_interests",
      retentionDays: 1095,
      specialBasis: "legal_claims",
    });
  });

  it("gives a service with no fields an empty list rather than an error", async () => {
    // The empty state and the error state are different screens, and this is
    // the line that keeps them apart on the way in (DoD §4).
    const page = await mockServiceFieldsApi.listForService("svc-poa");

    expect(page.fields).toEqual([]);
  });

  it("refuses a service that does not exist", async () => {
    await rejectsWith("not_found", () => mockServiceFieldsApi.listForService("svc-nope"));
  });

  it("carries the choices of a select, and nothing for the types that take none", async () => {
    const page = await mockServiceFieldsApi.listForService("svc-divorce");
    const by = (key: string) => page.fields.find((field) => field.key === key)?.options;

    expect(by("court_region")).toEqual(["Kyiv", "Lviv", "Odesa"]);
    expect(by("marriage_date")).toBeNull();
  });
});

describe("create", () => {
  it("appends the field after the last one rather than at the top", async () => {
    const created = await mockServiceFieldsApi.create(newField());

    expect(created.position).toBe(4);
    const page = await mockServiceFieldsApi.listForService("svc-divorce");
    expect(page.fields.at(-1)?.key).toBe("separation_reason");
  });

  it("writes the GDPR triad as one thing, in both directions", async () => {
    const created = await mockServiceFieldsApi.create(
      newField({
        personalData: {
          kind: "special",
          basis: "consent",
          retentionDays: 30,
          specialBasis: "explicit_consent",
        },
      }),
    );

    expect(created.personalData).toEqual({
      kind: "special",
      basis: "consent",
      retentionDays: 30,
      specialBasis: "explicit_consent",
    });
  });

  it("refuses a key the service already uses", async () => {
    // `unique (service_id, key)`. Refused here rather than left to the database,
    // because the fixture has no unique index and would accept it silently.
    await rejectsWith("validation", () =>
      mockServiceFieldsApi.create(newField({ key: "marriage_date" })),
    );
  });

  it("allows the same key on a different service", async () => {
    const created = await mockServiceFieldsApi.create(
      newField({ serviceId: "svc-alimony", key: "marriage_date" }),
    );

    expect(created.key).toBe("marriage_date");
  });

  it("refuses a blank label, a choice type with no options, and options on a plain type", async () => {
    await rejectsWith("validation", () => mockServiceFieldsApi.create(newField({ label: "  " })));
    await rejectsWith("validation", () =>
      mockServiceFieldsApi.create(newField({ type: "select", options: [] })),
    );
    await rejectsWith("validation", () =>
      mockServiceFieldsApi.create(newField({ type: "text", options: ["Kyiv"] })),
    );
  });

  it("refuses a service that does not exist", async () => {
    await rejectsWith("not_found", () =>
      mockServiceFieldsApi.create(newField({ serviceId: "svc-nope" })),
    );
  });
});

describe("update", () => {
  it("returns the updated field, so the caller needs no second round trip", async () => {
    const saved = await mockServiceFieldsApi.update({
      id: "qf-marriage-date",
      label: "Date the marriage was registered",
      helpText: "As on the certificate.",
      type: "date",
      required: true,
      options: null,
      personalData: { kind: "personal", basis: "contract", retentionDays: 365 },
    });

    expect(saved.label).toBe("Date the marriage was registered");
    expect(saved.personalData).toEqual({ kind: "personal", basis: "contract", retentionDays: 365 });
  });

  it("clears all five GDPR columns when a field stops being personal data", async () => {
    // The constraint is stated both ways, so a basis left behind is a row
    // Postgres refuses just as firmly as a missing one.
    const saved = await mockServiceFieldsApi.update({
      id: "qf-health-grounds",
      label: "Health circumstances relied on",
      helpText: null,
      type: "long_text",
      required: false,
      options: null,
      personalData: { kind: "none" },
    });

    expect(saved.personalData).toEqual({ kind: "none" });
  });

  it("refuses a field that does not exist", async () => {
    await rejectsWith("not_found", () =>
      mockServiceFieldsApi.update({
        id: "qf-nope",
        label: "Anything",
        helpText: null,
        type: "text",
        required: false,
        options: null,
        personalData: { kind: "none" },
      }),
    );
  });
});

describe("remove", () => {
  it("returns the id it removed, and the field is gone from the list", async () => {
    const removed = await mockServiceFieldsApi.remove("qf-marriage-date");
    const page = await mockServiceFieldsApi.listForService("svc-divorce");

    expect(removed).toBe("qf-marriage-date");
    expect(page.fields.map((field) => field.key)).not.toContain("marriage_date");
  });

  it("refuses a field that does not exist", async () => {
    await rejectsWith("not_found", () => mockServiceFieldsApi.remove("qf-nope"));
  });
});

describe("move", () => {
  it("swaps a field with the one above it", async () => {
    const fields = await mockServiceFieldsApi.move("qf-marriage-date", "up");

    expect(fields.map((field) => field.key)).toEqual([
      "marriage_date",
      "applicant_name",
      "court_region",
      "health_grounds",
    ]);
  });

  it("swaps a field with the one below it", async () => {
    const fields = await mockServiceFieldsApi.move("qf-applicant-name", "down");

    expect(fields.map((field) => field.key)).toEqual([
      "marriage_date",
      "applicant_name",
      "court_region",
      "health_grounds",
    ]);
  });

  it("re-derives every position rather than swapping two numbers", async () => {
    // Positions are not unique by design, so a list can arrive with gaps. A swap
    // would preserve them; a re-derivation ends them.
    const gapped = questionnaireFieldRows.find((row) => row.id === "qf-court-region");
    if (gapped !== undefined) gapped.position = 40;

    // The gap moves `court_region` to the end before anything is dragged, so
    // "down" from `marriage_date` swaps it with `health_grounds`. That is the
    // point: order comes from the sorted list, never from the stored number.
    const fields = await mockServiceFieldsApi.move("qf-marriage-date", "down");

    expect(fields.map((field) => field.key)).toEqual([
      "applicant_name",
      "health_grounds",
      "marriage_date",
      "court_region",
    ]);
    expect(fields.map((field) => field.position)).toEqual([0, 1, 2, 3]);
  });

  it("refuses to move the first field up or the last one down", async () => {
    // Refused rather than ignored: a silent no-op is indistinguishable from a
    // write that failed, and the screen would go on offering a dead control.
    await rejectsWith("validation", () => mockServiceFieldsApi.move("qf-applicant-name", "up"));
    await rejectsWith("validation", () => mockServiceFieldsApi.move("qf-health-grounds", "down"));
  });

  it("refuses a field that does not exist", async () => {
    await rejectsWith("not_found", () => mockServiceFieldsApi.move("qf-nope", "up"));
  });

  it("moves within one service and leaves another service's order alone", async () => {
    const untouched = await mockServiceFieldsApi.listForService("svc-alimony");
    await mockServiceFieldsApi.move("qf-marriage-date", "up");
    const after = await mockServiceFieldsApi.listForService("svc-alimony");

    expect(after.fields.map((field) => field.position)).toEqual(
      untouched.fields.map((field) => field.position),
    );
  });
});
