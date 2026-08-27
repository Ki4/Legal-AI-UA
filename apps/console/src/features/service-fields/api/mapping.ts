// Row to view model, and nothing else.
//
// It lives apart from both implementations because both run it, and because the
// alternative was worse than a duplicated function: the Supabase implementation
// importing it from `*.mock.ts` would drag `shared/api/fixture-store` — every
// fixture row in the workspace — into the production bundle through a type-only
// intention. DoD §2 forbids the import; this is why.

import type { QuestionnaireFieldRow } from "@legal-ai/db";
import type { FieldPersonalData, QuestionnaireFieldItem } from "./types";

/**
 * Total by construction (DoD §5). `options` is jsonb, so the generated type says
 * `Json` and a row written by hand — or by a migration nobody has run yet — can
 * hold an object where an array belongs. That renders as no options rather than
 * taking the screen down.
 */
export function optionsOf(value: QuestionnaireFieldRow["options"]): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((option) => String(option));
}

export function personalDataOf(row: QuestionnaireFieldRow): FieldPersonalData {
  // Read defensively, in the order the constraint states it. A row claiming to
  // be personal data with no basis cannot exist in Postgres; it can exist in a
  // hand-written fixture, and "none" is the reading that understates rather than
  // inventing a basis nobody chose.
  if (!row.is_personal_data || row.legal_basis === null || row.retention_days === null) {
    return { kind: "none" };
  }

  if (row.is_special_category && row.special_category_basis !== null) {
    return {
      kind: "special",
      basis: row.legal_basis,
      retentionDays: row.retention_days,
      specialBasis: row.special_category_basis,
    };
  }

  return { kind: "personal", basis: row.legal_basis, retentionDays: row.retention_days };
}

export function toField(row: QuestionnaireFieldRow): QuestionnaireFieldItem {
  return {
    id: row.id,
    serviceId: row.service_id,
    key: row.key,
    label: row.label,
    helpText: row.help_text,
    type: row.field_type,
    required: row.required,
    position: row.position,
    options: optionsOf(row.options),
    personalData: personalDataOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
