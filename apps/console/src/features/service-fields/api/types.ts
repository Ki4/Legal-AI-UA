// View models for the questionnaire field dictionary (§4.4).
//
// Rows are snake_case, these are camelCase, and the mapping between them is
// what this layer is for (ADR-0012).

import type { PersonalDataBasis, QuestionnaireFieldType, SpecialCategoryBasis } from "@legal-ai/db";

/**
 * What the platform is allowed to do with one field's answers.
 *
 * A union rather than five nullable properties, and that is the whole point:
 * `questionnaire_fields_gdpr_triad` refuses a row whose flag says personal and
 * whose basis or retention is missing, and `questionnaire_fields_special_category`
 * refuses a special category that is not also personal data. Modelled as loose
 * columns, a screen can hold every state the database rejects and only find out
 * on save. Modelled as this, the illegal states cannot be constructed —
 * the constraint and the type say the same thing, and the type says it first.
 *
 * `special` extends `personal` rather than replacing it, because Art. 9 is a
 * second statement about data that already needs an Art. 6 basis, never an
 * alternative to it (ADR-0013).
 */
export type FieldPersonalData =
  | { kind: "none" }
  | { kind: "personal"; basis: PersonalDataBasis; retentionDays: number }
  | {
      kind: "special";
      basis: PersonalDataBasis;
      retentionDays: number;
      specialBasis: SpecialCategoryBasis;
    };

export interface QuestionnaireFieldItem {
  id: string;
  serviceId: string;
  /**
   * Immutable, and enforced by a trigger rather than by this screen. Blocks and
   * frozen template versions reference it, so a rename would break a template
   * nobody is allowed to edit. The label is what the renaming urge gets.
   */
  key: string;
  label: string;
  helpText: string | null;
  type: QuestionnaireFieldType;
  required: boolean;
  position: number;
  /**
   * Present exactly when the type is `select` or `multi_select`, and never
   * empty — the same shape `questionnaire_fields_options` enforces.
   *
   * A flat list of strings, which is this screen giving the column its first
   * shape. Worth knowing that it is a decision and not a reading: the migration
   * says only "a non-empty jsonb array", and an option a *client* reads is
   * runtime reference data, which §6 of the DoD says carries a label per
   * language. Options do not yet. See the note in the PR — it needs a spec line,
   * not a guess made here.
   */
  options: readonly string[] | null;
  personalData: FieldPersonalData;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFieldsPage {
  serviceId: string;
  serviceTitle: string;
  /** Ordered by `position`, ascending. Never relied on to arrive that way (DoD §5). */
  fields: readonly QuestionnaireFieldItem[];
}

/** What the editor collects. `key` is here and absent from `FieldEdit` — see above. */
export interface NewQuestionnaireField {
  serviceId: string;
  key: string;
  label: string;
  helpText: string | null;
  type: QuestionnaireFieldType;
  required: boolean;
  options: readonly string[] | null;
  personalData: FieldPersonalData;
}

export interface FieldEdit {
  id: string;
  label: string;
  helpText: string | null;
  type: QuestionnaireFieldType;
  required: boolean;
  options: readonly string[] | null;
  personalData: FieldPersonalData;
}

/**
 * Why a field cannot be saved, in the words of what is wrong rather than of
 * which column is null. The screen turns each into a sentence; the layer refuses
 * regardless of what the screen does, because the mock has no constraint behind
 * it and would otherwise accept what Postgres rejects (DoD §2 — a convenient
 * fixture invalidates the arrangement).
 */
export type FieldRejection =
  | "key_shape"
  | "key_taken"
  | "label_empty"
  | "missing_basis"
  | "missing_retention"
  | "retention_not_positive"
  | "missing_special_basis"
  | "options_required"
  | "options_not_allowed";

/**
 * What the editor holds while it is being filled in — the same information as
 * `FieldPersonalData`, in the shape a half-answered form actually has.
 *
 * The two exist separately on purpose. `FieldPersonalData` cannot express "personal
 * data, basis not chosen yet", which is exactly right for something crossing the
 * api boundary and exactly wrong for a form, where that state is most of the
 * time the person spends. `validateDraft` is the one door between them, so the
 * illegal state exists in precisely one module and is named where it is checked.
 */
export interface FieldDraft {
  key: string;
  label: string;
  helpText: string;
  type: QuestionnaireFieldType;
  required: boolean;
  options: readonly string[];
  isPersonalData: boolean;
  basis: PersonalDataBasis | null;
  /** Kept as typed text: an empty box and a zero are different answers. */
  retentionDays: string;
  isSpecialCategory: boolean;
  specialBasis: SpecialCategoryBasis | null;
}
