// Fixture implementation, annotated with the contract so drift fails to compile
// (ADR-0012, DoD §2).
//
// It runs the same rules the Supabase one does, in the same order: refuse a
// shape the constraints refuse, refuse a key that is taken, refuse to move a
// field past either end, and re-derive `position` from the order rather than
// trusting what is stored. Those rules are the interesting part of this feature
// and they are assertable here without a database.
//
// What it cannot stand in for is RLS and the CHECK constraints. The fixture
// store has no policies and no constraints, which is precisely why the checks
// below are written out rather than left to the database: a fixture that accepts
// what Postgres refuses is a screen built against a lie.

import type { QuestionnaireFieldRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import {
  fixtureDelay,
  questionnaireFieldRows,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServiceFieldsApi } from "./contract";
import { typeNeedsOptions } from "./draft";
import { toField } from "./mapping";
import type {
  FieldEdit,
  FieldPersonalData,
  FieldRejection,
  NewQuestionnaireField,
  QuestionnaireFieldItem,
  ServiceFieldsPage,
} from "./types";

function reject(rejection: FieldRejection): never {
  throw new AppError("validation", `The field was refused: ${rejection}.`);
}

/**
 * `position` is deliberately not unique in the schema — a duplicate is cosmetic,
 * and a unique constraint would turn every reorder into a shuffle through
 * negative numbers. So order is decided here, and the key is the tie-break: two
 * fields sharing a position must still come out in the same order every time, or
 * the list rearranges itself under a reader who changed nothing (DoD §5).
 */
function inOrder(rows: readonly QuestionnaireFieldRow[]): QuestionnaireFieldRow[] {
  return [...rows].sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
}

function rowsOf(serviceId: string): QuestionnaireFieldRow[] {
  return inOrder(questionnaireFieldRows.filter((row) => row.service_id === serviceId));
}

function rowById(fieldId: string): QuestionnaireFieldRow {
  const row = questionnaireFieldRows.find((candidate) => candidate.id === fieldId);
  if (row === undefined) throw new AppError("not_found", "No such field.");
  return row;
}

function applyPersonalData(row: QuestionnaireFieldRow, personalData: FieldPersonalData): void {
  row.is_personal_data = personalData.kind !== "none";
  row.legal_basis = personalData.kind === "none" ? null : personalData.basis;
  row.retention_days = personalData.kind === "none" ? null : personalData.retentionDays;
  row.is_special_category = personalData.kind === "special";
  row.special_category_basis = personalData.kind === "special" ? personalData.specialBasis : null;
}

function checkShape(input: {
  label: string;
  type: QuestionnaireFieldItem["type"];
  options: readonly string[] | null;
}): void {
  if (input.label.trim() === "") reject("label_empty");

  const wantsOptions = typeNeedsOptions(input.type);
  if (wantsOptions && (input.options === null || input.options.length === 0)) {
    reject("options_required");
  }
  if (!wantsOptions && input.options !== null && input.options.length > 0) {
    reject("options_not_allowed");
  }
}

export const mockServiceFieldsApi: ServiceFieldsApi = {
  async listForService(serviceId) {
    await fixtureDelay();

    const service = serviceRows.find((row) => row.id === serviceId);
    if (service === undefined) throw new AppError("not_found", "No such service.");

    const page: ServiceFieldsPage = {
      serviceId,
      serviceTitle: service.title,
      fields: rowsOf(serviceId).map(toField),
    };

    return page;
  },

  async create(input: NewQuestionnaireField) {
    await fixtureDelay();

    const service = serviceRows.find((row) => row.id === input.serviceId);
    if (service === undefined) throw new AppError("not_found", "No such service.");

    checkShape(input);
    if (rowsOf(input.serviceId).some((row) => row.key === input.key)) reject("key_taken");

    const siblings = rowsOf(input.serviceId);
    const last = siblings[siblings.length - 1];
    const now = new Date().toISOString();

    const row: QuestionnaireFieldRow = {
      id: `qf-${input.serviceId}-${input.key}`,
      service_id: input.serviceId,
      key: input.key,
      label: input.label,
      help_text: input.helpText,
      field_type: input.type,
      required: input.required,
      // Appended, not inserted: a new field goes where the person can watch it
      // arrive. Off the last position rather than off the count, because a count
      // says nothing about a list whose positions already have gaps.
      position: last === undefined ? 0 : last.position + 1,
      options: input.options === null ? null : [...input.options],
      is_personal_data: false,
      legal_basis: null,
      retention_days: null,
      is_special_category: false,
      special_category_basis: null,
      created_at: now,
      updated_at: now,
    };
    applyPersonalData(row, input.personalData);

    questionnaireFieldRows.push(row);
    return toField(row);
  },

  async update(input: FieldEdit) {
    await fixtureDelay();

    checkShape(input);

    const row = rowById(input.id);
    row.label = input.label;
    row.help_text = input.helpText;
    row.field_type = input.type;
    row.required = input.required;
    row.options = input.options === null ? null : [...input.options];
    applyPersonalData(row, input.personalData);
    row.updated_at = new Date().toISOString();

    return toField(row);
  },

  async remove(fieldId) {
    await fixtureDelay();

    const index = questionnaireFieldRows.findIndex((row) => row.id === fieldId);
    if (index === -1) throw new AppError("not_found", "No such field.");

    questionnaireFieldRows.splice(index, 1);
    return fieldId;
  },

  async move(fieldId, direction) {
    await fixtureDelay();

    const row = rowById(fieldId);
    const siblings = rowsOf(row.service_id);
    const index = siblings.findIndex((candidate) => candidate.id === fieldId);
    const target = direction === "up" ? index - 1 : index + 1;

    // Refused rather than ignored. A silent no-op at the end of a list is
    // indistinguishable from a write that failed, and the screen would go on
    // offering a control that does nothing.
    if (target < 0 || target >= siblings.length) {
      throw new AppError("validation", "That field is already at the end of the list.");
    }

    const ordered = [...siblings];
    const [moved] = ordered.splice(index, 1);
    if (moved !== undefined) ordered.splice(target, 0, moved);

    // Positions are re-derived from the resulting order rather than swapped, so
    // a list that arrived with gaps or duplicates leaves here consistent.
    const now = new Date().toISOString();
    ordered.forEach((candidate, position) => {
      candidate.position = position;
      candidate.updated_at = now;
    });

    return ordered.map(toField);
  },
};
