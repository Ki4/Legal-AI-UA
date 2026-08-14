// The schema's words, and the dictionary key each of them is read as.
//
// It lives in `shared/` rather than in a feature because two features already
// render the same enums — the catalogue lists them, the card states them — and
// a second copy of this mapping is a second answer to "what does `in_review`
// say on screen". Features may not import from each other, so the shared layer
// is where the one answer goes.
//
// The maps are `Record<Enum, TranslationKey>`: adding a value to
// `service_status` in a migration and regenerating the row types makes this
// file fail to compile, which is the only moment anybody is going to remember
// that the new state also needs a word. A `??` fallback here would render the
// raw value instead and nobody would ever find out.

import type {
  AuditAction,
  AuditedTable,
  GenerationMode,
  ReviewMode,
  ServiceStatus,
} from "@legal-ai/db";
import type { TranslationKey } from "@legal-ai/i18n";

export const serviceStatusKey: Record<ServiceStatus, TranslationKey> = {
  draft: "service.status.draft",
  in_review: "service.status.in_review",
  published: "service.status.published",
  paused: "service.status.paused",
  archived: "service.status.archived",
};

export const generationModeKey: Record<GenerationMode, TranslationKey> = {
  template: "service.generationMode.template",
  block_assembly: "service.generationMode.block_assembly",
  full_generation: "service.generationMode.full_generation",
};

export const reviewModeKey: Record<ReviewMode, TranslationKey> = {
  auto: "service.reviewMode.auto",
  lawyer_required: "service.reviewMode.lawyer_required",
};

/**
 * What the log recorded as having happened. A real enum, so this map has the
 * same property as the three above: a value added to `audit_action` in a
 * migration fails to compile here until it also has a word.
 */
export const auditActionKey: Record<AuditAction, TranslationKey> = {
  insert: "history.action.insert",
  update: "history.action.update",
  delete: "history.action.delete",
};

/**
 * What was changed. Weaker than the maps above, and the difference is worth
 * knowing rather than papering over: `entity_table` is `text`, so the compiler
 * cannot tell anyone that a migration added an audit trigger to a table with no
 * word for it. `AuditedTable` is a hand-kept list checked only for being real
 * tables; the screen renders the raw name for anything outside it (DoD §5 —
 * bad data renders as visibly odd text rather than as nothing).
 */
export const auditedTableKey: Record<AuditedTable, TranslationKey> = {
  services: "history.entity.services",
  service_versions: "history.entity.service_versions",
  service_version_prices: "history.entity.service_version_prices",
  questionnaire_fields: "history.entity.questionnaire_fields",
  service_assignments: "history.entity.service_assignments",
};
