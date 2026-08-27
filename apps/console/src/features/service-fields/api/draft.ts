// The one door between a half-filled form and something the database will
// accept.
//
// Every rule here is a restatement of a CHECK constraint in
// `20260811130000_questionnaire_fields.sql`, and that duplication is deliberate
// rather than regrettable: the constraint is what makes the rule true, and this
// is what lets a person be told *which* half is missing while they are still
// typing. What must not happen is the screen being more permissive than the
// database — so this module is what both the form and the fixture run, and the
// tests beside it assert each rule in both halves.

import type {
  FieldDraft,
  FieldPersonalData,
  FieldRejection,
  QuestionnaireFieldItem,
} from "./types";

/** Mirrors `questionnaire_fields_key_shape`. */
export const KEY_SHAPE = /^[a-z][a-z0-9_]*$/;

export const OPTION_TYPES = ["select", "multi_select"] as const;

export function typeNeedsOptions(type: FieldDraft["type"]): boolean {
  return (OPTION_TYPES as readonly string[]).includes(type);
}

export function emptyDraft(): FieldDraft {
  return {
    key: "",
    label: "",
    helpText: "",
    type: "text",
    required: false,
    options: [],
    isPersonalData: false,
    basis: null,
    retentionDays: "",
    isSpecialCategory: false,
    specialBasis: null,
  };
}

/** An existing field, opened for editing. The inverse of `validateDraft`. */
export function draftOf(field: QuestionnaireFieldItem): FieldDraft {
  const { personalData } = field;

  return {
    key: field.key,
    label: field.label,
    helpText: field.helpText ?? "",
    type: field.type,
    required: field.required,
    options: field.options ?? [],
    isPersonalData: personalData.kind !== "none",
    basis: personalData.kind === "none" ? null : personalData.basis,
    retentionDays: personalData.kind === "none" ? "" : String(personalData.retentionDays),
    isSpecialCategory: personalData.kind === "special",
    specialBasis: personalData.kind === "special" ? personalData.specialBasis : null,
  };
}

export type DraftValidation =
  | { ok: true; personalData: FieldPersonalData; options: readonly string[] | null }
  | { ok: false; rejections: readonly FieldRejection[] };

/**
 * Every reason at once, not the first one found.
 *
 * A form that reports one problem per attempt makes a person save four times to
 * learn about four blanks, and each attempt looks to them like a fresh refusal
 * of something they just fixed.
 */
export function validateDraft(
  draft: FieldDraft,
  options: { takenKeys?: readonly string[]; checkKey?: boolean } = {},
): DraftValidation {
  const { takenKeys = [], checkKey = true } = options;
  const rejections: FieldRejection[] = [];

  if (checkKey) {
    if (!KEY_SHAPE.test(draft.key)) rejections.push("key_shape");
    else if (takenKeys.includes(draft.key)) rejections.push("key_taken");
  }

  if (draft.label.trim() === "") rejections.push("label_empty");

  const wantsOptions = typeNeedsOptions(draft.type);
  const filled = draft.options.map((option) => option.trim()).filter((option) => option !== "");

  if (wantsOptions && filled.length === 0) rejections.push("options_required");
  // Not merely tidiness: `questionnaire_fields_options` requires `options` to be
  // null for every other type, so options left behind by a type the person
  // changed their mind about are a row Postgres refuses.
  if (!wantsOptions && filled.length > 0) rejections.push("options_not_allowed");

  const personalData = personalDataOf(draft, rejections);

  if (rejections.length > 0) return { ok: false, rejections };
  if (personalData === null) return { ok: false, rejections: ["missing_basis"] };

  return { ok: true, personalData, options: wantsOptions ? filled : null };
}

function personalDataOf(draft: FieldDraft, rejections: FieldRejection[]): FieldPersonalData | null {
  if (!draft.isPersonalData) {
    // The constraint is stated both ways, so this arm is not "nothing to check":
    // a special-category marker surviving the flag being turned off is a row
    // Postgres refuses. The screen clears it; the check is what makes that a
    // guarantee rather than a habit.
    return { kind: "none" };
  }

  if (draft.basis === null) rejections.push("missing_basis");

  const retention = Number(draft.retentionDays);
  if (draft.retentionDays.trim() === "") rejections.push("missing_retention");
  else if (!Number.isInteger(retention) || retention <= 0)
    rejections.push("retention_not_positive");

  if (draft.isSpecialCategory && draft.specialBasis === null)
    rejections.push("missing_special_basis");

  if (rejections.length > 0 || draft.basis === null) return null;

  return draft.isSpecialCategory && draft.specialBasis !== null
    ? {
        kind: "special",
        basis: draft.basis,
        retentionDays: retention,
        specialBasis: draft.specialBasis,
      }
    : { kind: "personal", basis: draft.basis, retentionDays: retention };
}
