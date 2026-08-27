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
  LawNormScope,
  LawNormState,
  LawSource,
  OrderStatus,
  PersonalDataBasis,
  QuestionnaireFieldType,
  ReviewMode,
  SpecialCategoryBasis,
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
  plan_services: "history.entity.plan_services",
  orders: "history.entity.orders",
  service_law_refs: "history.entity.service_law_refs",
};

/**
 * The lifecycle of an order (§4.16, ADR-0005). A real enum, so a state added to
 * `order_status` in a migration fails to compile here until it also has a word
 * — which matters more than usual on this one: the states are what the screen
 * *is*, and a `??` fallback would render `in_review` at a client-facing
 * milestone and nobody would find out until they read it.
 */
/**
 * What a watched norm is currently known to be (§9.11). Six values, where the
 * spec's table lists eight — `stale by time` and `scheduled` are derived and
 * therefore have no schema value to map. Their words live under
 * `law.freshness.*`, which is where the code that derives them looks.
 */
export const lawNormStateKey: Record<LawNormState, TranslationKey> = {
  unverified: "law.state.unverified",
  verified: "law.state.verified",
  drifted: "law.state.drifted",
  under_review: "law.state.under_review",
  impact_confirmed: "law.state.impact_confirmed",
  unreachable: "law.state.unreachable",
};

/** Article by default, whole act as the marked exception (§9.4). */
export const lawNormScopeKey: Record<LawNormScope, TranslationKey> = {
  article: "law.field.article",
  act: "law.wholeAct",
};

/**
 * Where a norm is published. A hostname is not interface copy — it is the same
 * string in both languages — but it goes through a key anyway, because the day a
 * second source arrives it needs a name a reader recognizes rather than a
 * domain.
 */
export const lawSourceKey: Record<LawSource, TranslationKey> = {
  zakon_rada: "law.source.zakon_rada",
};

export const orderStatusKey: Record<OrderStatus, TranslationKey> = {
  intake: "order.status.intake",
  submitted: "order.status.submitted",
  generating: "order.status.generating",
  in_review: "order.status.in_review",
  delivered: "order.status.delivered",
  cancelled: "order.status.cancelled",
  abandoned: "order.status.abandoned",
};

/**
 * What a questionnaire field asks for (§4.4). A real enum, so a type added to
 * `questionnaire_field_type` in a migration fails to compile here until it also
 * has a word — which matters on this one because the type decides whether the
 * field carries options at all.
 */
export const fieldTypeKey: Record<QuestionnaireFieldType, TranslationKey> = {
  text: "field.type.text",
  long_text: "field.type.long_text",
  number: "field.type.number",
  date: "field.type.date",
  boolean: "field.type.boolean",
  select: "field.type.select",
  multi_select: "field.type.multi_select",
};

/**
 * GDPR Art. 6(1)(a)-(f), by name rather than by letter — the migration made the
 * same choice for the same reason: `contract` survives being read in two years,
 * `(b)` does not. A lawyer picks from these, so the word on screen has to be the
 * one they would say out loud.
 */
export const personalDataBasisKey: Record<PersonalDataBasis, TranslationKey> = {
  consent: "gdpr.basis.consent",
  contract: "gdpr.basis.contract",
  legal_obligation: "gdpr.basis.legal_obligation",
  vital_interests: "gdpr.basis.vital_interests",
  public_task: "gdpr.basis.public_task",
  legitimate_interests: "gdpr.basis.legitimate_interests",
};

/**
 * GDPR Art. 9(2)(a)-(j). A separate statement from the Art. 6 basis above and
 * never a replacement for it (ADR-0013), which is why there are two maps and not
 * one with ten more entries.
 */
export const specialCategoryBasisKey: Record<SpecialCategoryBasis, TranslationKey> = {
  explicit_consent: "gdpr.specialBasis.explicit_consent",
  employment_social_security: "gdpr.specialBasis.employment_social_security",
  vital_interests: "gdpr.specialBasis.vital_interests",
  not_for_profit_body: "gdpr.specialBasis.not_for_profit_body",
  made_public_by_subject: "gdpr.specialBasis.made_public_by_subject",
  legal_claims: "gdpr.specialBasis.legal_claims",
  substantial_public_interest: "gdpr.specialBasis.substantial_public_interest",
  health_care: "gdpr.specialBasis.health_care",
  public_health: "gdpr.specialBasis.public_health",
  archiving_research: "gdpr.specialBasis.archiving_research",
};
