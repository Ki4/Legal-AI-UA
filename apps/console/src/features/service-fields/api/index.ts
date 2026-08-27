// The swap point. One line picks the implementation (ADR-0012).
//
// Live from the first commit, for the reason `law` gives: this table has a
// writer, and the writer is the lawyer reading this screen. Fixtures would show
// a dictionary the service does not have and then accept a field that goes
// nowhere — a version nobody can tell from a working one.
//
// `service-fields.mock.ts` stays. It is what the contract tests run against:
// every refusal, the append position, the re-derived order and the GDPR triad in
// both directions are assertable there without a database.

import type { ServiceFieldsApi } from "./contract";
import { supabaseServiceFieldsApi } from "./service-fields.supabase";

export const serviceFieldsApi: ServiceFieldsApi = supabaseServiceFieldsApi;

export type { ServiceFieldsApi } from "./contract";
export { draftOf, emptyDraft, typeNeedsOptions, validateDraft, KEY_SHAPE } from "./draft";
export type { DraftValidation } from "./draft";
export type {
  FieldDraft,
  FieldEdit,
  FieldPersonalData,
  FieldRejection,
  NewQuestionnaireField,
  QuestionnaireFieldItem,
  ServiceFieldsPage,
} from "./types";
