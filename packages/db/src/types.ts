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
export type OrderStatus = Enums["order_status"];
export type EntitlementKind = Enums["entitlement_kind"];

/**
 * The same values at runtime, for narrowing a state that arrives as loose text.
 * The audit log stores payloads as `jsonb`, so a status read back out of it is
 * a `string` until something checks it.
 *
 * `satisfies` catches a value that stops being a state; it cannot catch one
 * that is added and missed here. What does is `orderStatusKey` in the console's
 * `shared/vocabulary.ts`: a `Record<OrderStatus, TranslationKey>` fails to
 * compile until a new state also has a word, and a state with a word and no
 * entry here would render on the card and vanish from the timeline — visibly
 * odd, which is the failure this pair is arranged to produce rather than
 * silence.
 */
export const ORDER_STATUSES = [
  "intake",
  "submitted",
  "generating",
  "in_review",
  "delivered",
  "cancelled",
  "abandoned",
] as const satisfies readonly OrderStatus[];

/**
 * Not an enum in the database: `profiles.role` is `text`, and a row can carry
 * no role at all while a registration waits for approval.
 */
export type Role = "admin" | "lawyer";

/**
 * `profiles.role` is a `text` column with no check constraint — the only thing
 * that ever writes it is the `approve_user` RPC, which validates the value, but
 * the column itself will hold anything. Narrowing therefore has to happen at
 * the boundary rather than being asserted: a row that somehow carries a
 * nonsense role reads as "no role yet", which is the safe interpretation.
 */
export function asRole(value: string | null): Role | null {
  return value === "admin" || value === "lawyer" ? value : null;
}

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

/**
 * A branch of law a service sits in (ADR-0015). Keyed by its code rather than by
 * a surrogate id: fifteen immutable rows have no use for a second identity, and
 * the code is what appears in a filter URL.
 */
export type PracticeAreaRow = Tables["practice_areas"]["Row"];

/**
 * Who may act on a service. Exactly one row per service carries `is_primary`
 * and with it the obligations; the rest are cover, with the same rights and
 * none of the accountability.
 */
export type ServiceAssignmentRow = Tables["service_assignments"]["Row"];

export type AuditEventRow = Tables["audit_events"]["Row"];

/**
 * The pseudonymous anchor (ADM-62). Holds no personal data at all — the mapping
 * to a person is `client_identities`, which nothing in this console may read.
 */
export type ClientRow = Tables["clients"]["Row"];

export type OrderRow = Tables["orders"]["Row"];

export type EntitlementRow = Tables["entitlements"]["Row"];

/**
 * The tables a per-service history can show a change to (spec §4.8).
 *
 * `audit_events.entity_table` is `text`, not an enum — the log records the
 * table a trigger fired on, and a table is not a value the database can
 * enumerate. So the exhaustiveness the other vocabulary here relies on is not
 * available: nothing makes a migration that adds a trigger fail to compile
 * until the new table also has a word. `satisfies readonly (keyof Tables)[]`
 * buys back the half that is checkable — a table renamed or dropped in a
 * migration breaks this list on the next `pnpm db:types` — and `asAuditedTable`
 * covers the other half at runtime, so an unmapped table renders as itself
 * rather than as nothing.
 *
 * Client tables are absent deliberately, not by oversight. `clients`,
 * `client_identities`, `entitlements` and `entitlement_services` all log with a
 * null `service_id` — they belong to no service, and for the entitlement pair
 * that null is a decision rather than an accident (ADR-0019: a purchase is
 * billing, and billing is not the accountable lawyer's cut of the log). None of
 * them can appear on a screen filtered to one service.
 *
 * `plan_services` and `orders` are here because they are the two that do carry
 * a service: a service joining a paid plan changes who may order it, and an
 * order is the matter under it. Both arrived on 2026-08-15 and neither was
 * added at the time, which is the failure this comment predicts one paragraph
 * up — nothing makes a migration that adds a trigger fail to compile here.
 */
export const AUDITED_TABLES = [
  "services",
  "service_versions",
  "service_version_prices",
  "questionnaire_fields",
  "service_assignments",
  "plan_services",
  "orders",
] as const satisfies readonly (keyof Tables)[];

export type AuditedTable = (typeof AUDITED_TABLES)[number];

/** Narrows a logged table name, the way `asRole` narrows a `text` role. */
export function asAuditedTable(value: string): AuditedTable | null {
  return (AUDITED_TABLES as readonly string[]).includes(value) ? (value as AuditedTable) : null;
}

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
