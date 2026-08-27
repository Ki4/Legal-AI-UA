// Supabase implementation of ServiceFieldsApi.
//
// Three things shape it.
//
// **The constraints are the authority, and this file does not pretend
// otherwise.** `questionnaire_fields_gdpr_triad`, `_special_category` and
// `_options` refuse a half-filled row, and the immutable-key trigger refuses a
// rename. The checks here exist so the reader is told which half is missing
// while they are still typing; the row that reaches Postgres is checked again
// regardless, and `fromPostgrest` turns 23514 and P0001 into `validation` so a
// refusal we failed to anticipate still arrives as a sentence rather than as
// "unknown".
//
// **`key` never appears in an update.** The trigger raises on a change, so
// offering the column at all would mean sending a value that is either identical
// or an exception. `FieldEdit` has no `key`, and this is where that pays.
//
// **Reordering re-derives every position rather than swapping two.** Positions
// are not unique by design, so a list can arrive with gaps or duplicates; a swap
// preserves both, a re-derivation ends them. Only the rows whose number actually
// changed are written.

import { supabase } from "../../../app/supabase";
import { AppError, expectOne } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { ServiceFieldsApi } from "./contract";
import { toField } from "./mapping";
import type {
  FieldEdit,
  FieldPersonalData,
  NewQuestionnaireField,
  QuestionnaireFieldItem,
} from "./types";

const FIELD_SELECT = `
  id, service_id, key, label, help_text, field_type, required, position, options,
  is_personal_data, legal_basis, retention_days,
  is_special_category, special_category_basis,
  created_at, updated_at
` as const;

function fieldsQuery() {
  return supabase.from("questionnaire_fields").select(FIELD_SELECT);
}

/**
 * The GDPR triad written out as columns, in both directions.
 *
 * The `null`s are not padding. The constraint is stated both ways — personal
 * data with a basis and a retention, or none of the three — so a field that
 * stops being personal data has to *clear* what it had. An update that only set
 * the flag would leave a basis behind and be refused, correctly and
 * confusingly.
 */
function personalDataColumns(personalData: FieldPersonalData) {
  return {
    is_personal_data: personalData.kind !== "none",
    legal_basis: personalData.kind === "none" ? null : personalData.basis,
    retention_days: personalData.kind === "none" ? null : personalData.retentionDays,
    is_special_category: personalData.kind === "special",
    special_category_basis: personalData.kind === "special" ? personalData.specialBasis : null,
  };
}

function writableColumns(input: FieldEdit | NewQuestionnaireField) {
  return {
    label: input.label,
    help_text: input.helpText,
    field_type: input.type,
    required: input.required,
    options: input.options === null ? null : [...input.options],
    ...personalDataColumns(input.personalData),
  };
}

async function fieldsOf(serviceId: string): Promise<QuestionnaireFieldItem[]> {
  const { data, error } = await fieldsQuery()
    .eq("service_id", serviceId)
    // Ordered in the database and tie-broken by key, matching `inOrder` in the
    // fixture. Two implementations that disagree about order are two screens.
    .order("position", { ascending: true })
    .order("key", { ascending: true });

  if (error) throw fromPostgrest(error, "Loading the questionnaire fields");

  return (data ?? []).map(toField);
}

export const supabaseServiceFieldsApi: ServiceFieldsApi = {
  async listForService(serviceId) {
    const { data: service, error } = await supabase
      .from("services")
      .select("id, title")
      .eq("id", serviceId)
      .maybeSingle();

    if (error) throw fromPostgrest(error, "Loading the service");
    // `maybeSingle` returns null both for a service that does not exist and for
    // one `services_select_staff` hides. The screen renders "not found" for
    // both, which is the honest reading: a reader who may not see it has no way
    // to tell, and neither have we.
    if (service === null) throw new AppError("not_found", "No such service.");

    return { serviceId, serviceTitle: service.title, fields: await fieldsOf(serviceId) };
  },

  async create(input) {
    const { data, error } = await supabase
      .from("questionnaire_fields")
      .insert({
        service_id: input.serviceId,
        key: input.key,
        ...writableColumns(input),
      })
      .select(FIELD_SELECT);

    if (error) throw fromPostgrest(error, "Adding the field");

    return toField(expectOne(data ?? [], "Adding the field"));
  },

  async update(input) {
    const { data, error } = await supabase
      .from("questionnaire_fields")
      .update(writableColumns(input))
      .eq("id", input.id)
      .select(FIELD_SELECT);

    if (error) throw fromPostgrest(error, "Saving the field");

    return toField(expectOne(data ?? [], "Saving the field"));
  },

  async remove(fieldId) {
    const { data, error } = await supabase
      .from("questionnaire_fields")
      .delete()
      .eq("id", fieldId)
      .select("id");

    if (error) throw fromPostgrest(error, "Deleting the field");

    return expectOne(data ?? [], "Deleting the field").id;
  },

  async move(fieldId, direction) {
    const { data: row, error: readError } = await supabase
      .from("questionnaire_fields")
      .select("id, service_id")
      .eq("id", fieldId)
      .maybeSingle();

    if (readError) throw fromPostgrest(readError, "Reading the field");
    if (row === null) throw new AppError("not_found", "No such field.");

    const siblings = await fieldsOf(row.service_id);
    const index = siblings.findIndex((candidate) => candidate.id === fieldId);
    const target = direction === "up" ? index - 1 : index + 1;

    if (index === -1) throw new AppError("not_found", "No such field.");
    if (target < 0 || target >= siblings.length) {
      throw new AppError("validation", "That field is already at the end of the list.");
    }

    const ordered = [...siblings];
    const [moved] = ordered.splice(index, 1);
    if (moved !== undefined) ordered.splice(target, 0, moved);

    // Sequential rather than parallel, and only where the number changed.
    // Usually two rows; a list with duplicate positions can be more, and that is
    // the case worth being correct in rather than fast in.
    for (const [position, field] of ordered.entries()) {
      if (field.position === position) continue;

      const { data, error } = await supabase
        .from("questionnaire_fields")
        .update({ position })
        .eq("id", field.id)
        .select("id");

      if (error) throw fromPostgrest(error, "Reordering the fields");
      expectOne(data ?? [], "Reordering the fields");
    }

    return await fieldsOf(row.service_id);
  },
};
