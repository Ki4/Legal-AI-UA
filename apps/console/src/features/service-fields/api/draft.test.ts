// The rules that decide whether a field can be saved — each one asserted in
// both halves: a draft that must be refused, and the draft one change away that
// must not. A validator that refuses everything and one that refuses nothing are
// equally useless, and only the pair tells them apart.
//
// Every rule here restates a CHECK constraint in
// `20260811130000_questionnaire_fields.sql`. The tests name the constraint they
// mirror, so a migration that relaxes one has a failing test pointing at the
// screen that still believes it.

import { describe, expect, it } from "vitest";
import { draftOf, emptyDraft, validateDraft } from "./draft";
import type { FieldDraft, QuestionnaireFieldItem } from "./types";

function draft(overrides: Partial<FieldDraft> = {}): FieldDraft {
  return { ...emptyDraft(), key: "applicant_name", label: "Applicant", ...overrides };
}

function rejectionsOf(input: FieldDraft, options?: Parameters<typeof validateDraft>[1]) {
  const result = validateDraft(input, options);
  return result.ok ? [] : result.rejections;
}

describe("key shape — questionnaire_fields_key_shape", () => {
  it("accepts lowercase, digits and underscores after a leading letter", () => {
    expect(rejectionsOf(draft({ key: "applicant_name_2" }))).toEqual([]);
  });

  it.each([["Applicant"], ["2nd_name"], ["applicant name"], ["applicant-name"], [""]])(
    "refuses %j",
    (key) => {
      expect(rejectionsOf(draft({ key }))).toContain("key_shape");
    },
  );

  it("refuses a key the service already uses, and allows one it does not", () => {
    expect(rejectionsOf(draft({ key: "taken" }), { takenKeys: ["taken"] })).toContain("key_taken");
    expect(rejectionsOf(draft({ key: "free" }), { takenKeys: ["taken"] })).toEqual([]);
  });

  it("skips the key entirely when editing, because a key cannot change", () => {
    // The trigger refuses a rename, so an existing field's key is not up for
    // review — and reporting it as taken would report it against itself.
    expect(
      rejectionsOf(draft({ key: "taken" }), { takenKeys: ["taken"], checkKey: false }),
    ).toEqual([]);
  });
});

describe("label", () => {
  it("refuses a label that is blank or only spaces, and accepts one with a word", () => {
    expect(rejectionsOf(draft({ label: "   " }))).toContain("label_empty");
    expect(rejectionsOf(draft({ label: " Applicant " }))).toEqual([]);
  });
});

describe("options — questionnaire_fields_options", () => {
  it("requires a choice type to carry at least one non-empty option", () => {
    expect(rejectionsOf(draft({ type: "select", options: ["  ", ""] }))).toContain(
      "options_required",
    );

    const accepted = validateDraft(draft({ type: "select", options: ["Kyiv", " ", "Lviv"] }));
    expect(accepted.ok && accepted.options).toEqual(["Kyiv", "Lviv"]);
  });

  it("refuses options left behind by a type that no longer takes them", () => {
    // The constraint says `options is null` for every other type, so this is a
    // row Postgres rejects rather than untidiness.
    expect(rejectionsOf(draft({ type: "text", options: ["Kyiv"] }))).toContain(
      "options_not_allowed",
    );

    const accepted = validateDraft(draft({ type: "text", options: [] }));
    expect(accepted.ok && accepted.options).toBeNull();
  });
});

describe("the GDPR triad — questionnaire_fields_gdpr_triad", () => {
  it("passes through a field that is not personal data", () => {
    const result = validateDraft(draft());
    expect(result.ok && result.personalData).toEqual({ kind: "none" });
  });

  it("refuses personal data with no basis, and accepts it with one", () => {
    const missing = draft({ isPersonalData: true, retentionDays: "1095" });
    expect(rejectionsOf(missing)).toContain("missing_basis");

    const complete = validateDraft({ ...missing, basis: "contract" });
    expect(complete.ok && complete.personalData).toEqual({
      kind: "personal",
      basis: "contract",
      retentionDays: 1095,
    });
  });

  it("refuses personal data with no retention, and accepts it with one", () => {
    const missing = draft({ isPersonalData: true, basis: "contract" });
    expect(rejectionsOf(missing)).toContain("missing_retention");
    expect(rejectionsOf({ ...missing, retentionDays: "1095" })).toEqual([]);
  });

  it("separates an empty retention from a retention of zero", () => {
    // `questionnaire_fields_retention_positive`. An empty box is a question not
    // yet answered; a zero is an answer, and a wrong one — a different sentence
    // for the reader, so a different rejection.
    const personal = draft({ isPersonalData: true, basis: "contract" });
    expect(rejectionsOf({ ...personal, retentionDays: "" })).toContain("missing_retention");
    expect(rejectionsOf({ ...personal, retentionDays: "0" })).toContain("retention_not_positive");
    expect(rejectionsOf({ ...personal, retentionDays: "-5" })).toContain("retention_not_positive");
    expect(rejectionsOf({ ...personal, retentionDays: "30.5" })).toContain(
      "retention_not_positive",
    );
    expect(rejectionsOf({ ...personal, retentionDays: "30" })).toEqual([]);
  });

  it("reports every missing half at once rather than one per attempt", () => {
    // A form that reveals one blank per save makes a person save three times to
    // learn about three blanks, and each refusal looks like a rejection of what
    // they just fixed.
    const bare = draft({ key: "Bad Key", label: "", isPersonalData: true });
    expect([...rejectionsOf(bare)].sort()).toEqual(
      ["key_shape", "label_empty", "missing_basis", "missing_retention"].sort(),
    );
  });
});

describe("special category — questionnaire_fields_special_category", () => {
  const special = draft({
    isPersonalData: true,
    basis: "legitimate_interests",
    retentionDays: "1095",
    isSpecialCategory: true,
  });

  it("refuses a special category with no Art. 9 basis, and accepts it with one", () => {
    expect(rejectionsOf(special)).toContain("missing_special_basis");

    const complete = validateDraft({ ...special, specialBasis: "legal_claims" });
    expect(complete.ok && complete.personalData).toEqual({
      kind: "special",
      basis: "legitimate_interests",
      retentionDays: 1095,
      specialBasis: "legal_claims",
    });
  });

  it("keeps the Art. 6 basis when Art. 9 applies, rather than replacing it", () => {
    // ADR-0013: one column cannot hold both statements, and a special category
    // is a subset of personal data rather than an alternative to it.
    const complete = validateDraft({ ...special, specialBasis: "legal_claims" });
    expect(
      complete.ok && complete.personalData.kind === "special" && complete.personalData.basis,
    ).toBe("legitimate_interests");
  });
});

describe("draftOf", () => {
  function field(personalData: QuestionnaireFieldItem["personalData"]): QuestionnaireFieldItem {
    return {
      id: "qf-1",
      serviceId: "svc-divorce",
      key: "applicant_name",
      label: "Applicant",
      helpText: null,
      type: "text",
      required: true,
      position: 0,
      options: null,
      personalData,
      createdAt: "2026-05-12T09:25:00.000Z",
      updatedAt: "2026-05-12T09:25:00.000Z",
    };
  }

  it("round-trips each of the three GDPR shapes", () => {
    // The inverse of `validateDraft`, and the property worth holding: reopening
    // a saved field and saving it again must not change it.
    for (const personalData of [
      { kind: "none" } as const,
      { kind: "personal", basis: "contract", retentionDays: 1095 } as const,
      {
        kind: "special",
        basis: "legitimate_interests",
        retentionDays: 30,
        specialBasis: "legal_claims",
      } as const,
    ]) {
      const result = validateDraft(draftOf(field(personalData)), { checkKey: false });
      expect(result.ok && result.personalData).toEqual(personalData);
    }
  });

  it("renders a missing help text as an empty box rather than as the word null", () => {
    expect(draftOf(field({ kind: "none" })).helpText).toBe("");
  });
});
