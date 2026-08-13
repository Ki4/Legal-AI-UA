// View model for the anatomy screen (ADR-0012, convention 1 and 6).
//
// The trace already arrives shaped for a screen rather than a table row — it
// crosses the core gateway (ADR-0004) instead of Postgres, so packages/db
// keeps it hand-written and camelCase already (packages/db/src/types.ts).
// What still belongs to the feature is what belongs to every other one: the
// type a component renders is this layer's to name, so a component imports
// `../api`, never `@legal-ai/db` — even though, for this fixture, the shapes
// happen to match field for field.
//
// `BlockTrust` is domain vocabulary, not a view model — the same status as
// `GenerationMode`/`ReviewMode`/`ServiceStatus` in `features/services/api`
// (convention 6) — so it is re-exported from `packages/db` rather than
// redeclared.

import type { BlockTrust } from "@legal-ai/db";

export type { BlockTrust } from "@legal-ai/db";

export interface TraceBlockView {
  id: string;
  title: string;
  trust: BlockTrust;
  needsAttention: boolean;
  lawRefs: string[];
  questionnaireFields: string[];
}

export interface GenerationTraceView {
  serviceId: string;
  blocks: TraceBlockView[];
}
