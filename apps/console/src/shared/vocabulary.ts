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

import type { GenerationMode, ReviewMode, ServiceStatus } from "@legal-ai/db";
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
