// Domain vocabulary shared by both apps.
//
// Row types are no longer written by hand: they are derived from
// `database.types.ts`, which `pnpm db:types` regenerates from the schema. That
// was always the plan (ADR-0012), and it stopped being optional the moment the
// hand-written shapes disagreed with the tables — `ServiceVersionRow` still
// carried `priceMinor` and `currency` after prices moved to their own
// per-currency table.
//
// The consequence worth knowing: **rows are snake_case, view models are
// camelCase.** That is not an inconsistency, it is the seam. A row is what
// Postgres returns; a view model is what a screen renders. The mapping between
// them lives in each feature's `api/`, which is exactly the layer ADR-0012
// created so that regenerating this file cannot reach a component.
//
// Nothing screen-specific belongs here — a view model lives in its feature's
// own api/types.ts (ADR-0012, convention 6), or regeneration would flatten it.

import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type ServiceStatus = Enums["service_status"];
export type GenerationMode = Enums["generation_mode"];
export type ReviewMode = Enums["review_mode"];
export type QuestionnaireFieldType = Enums["questionnaire_field_type"];
export type PersonalDataBasis = Enums["personal_data_basis"];
export type SpecialCategoryBasis = Enums["special_category_basis"];
export type AuditAction = Enums["audit_action"];

/**
 * Not an enum in the database: `profiles.role` is `text`, and a row can carry
 * no role at all while a registration waits for approval.
 */
export type Role = "admin" | "lawyer";

/**
 * A catalogue entry. Everything that varies over time — modes, price, status —
 * lives on the version, so a published version can be frozen while the service
 * keeps a stable identity for an issued document to pin (ADR-0009).
 */
export type ServiceRow = Tables["services"]["Row"];

export type ServiceVersionRow = Tables["service_versions"]["Row"];

/**
 * One row per currency (spec §8.6). We sell in UAH; a version frozen at
 * publication could not gain a second currency afterwards, so the shape has to
 * allow for one before it is needed rather than after.
 */
export type ServiceVersionPriceRow = Tables["service_version_prices"]["Row"];

export type QuestionnaireFieldRow = Tables["questionnaire_fields"]["Row"];

export type AuditEventRow = Tables["audit_events"]["Row"];

/**
 * `full_name` is nullable because the column is: it comes from the registration
 * form's metadata and a row can exist without one. A view model that claimed
 * otherwise would compile and then meet its first nameless lawyer in
 * production.
 */
export type ProfileRow = Tables["profiles"]["Row"];

export type { Database } from "./database.types";

// The generation trace is not a table — it crosses the gateway from the core
// (ADR-0004) and is versioned by its own `traceVersion`, so it stays
// hand-written here.

export type BlockTrust = "template" | "ai_generated" | "lawyer_edited";

export interface TraceBlock {
  id: string;
  title: string;
  trust: BlockTrust;
  needsAttention: boolean;
  lawRefs: string[];
  questionnaireFields: string[];
}

export interface GenerationTrace {
  traceVersion: 1;
  serviceId: string;
  blocks: TraceBlock[];
}
