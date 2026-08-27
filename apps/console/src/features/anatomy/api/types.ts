// View model for the anatomy screen (ADR-0012, convention 1 and 6).
//
// The trace does not come from Postgres. It crosses the core gateway
// (ADR-0004) from a Python service, so its shape is `packages/core-client`'s —
// snake_case, because that is what is on the wire (ADR-0021 §6) — and this
// layer is where it stops being that. Every other feature maps a snake_case
// row to a camelCase view model here; anatomy now does the same work for the
// same reason, and the mapper in `anatomy.mock.ts` is a real one rather than
// the field-for-field copy it used to apologise for.
//
// `BlockTrust` is domain vocabulary, not a view model — the same status as
// `GenerationMode`/`ReviewMode`/`ServiceStatus` in `features/services/api`
// (convention 6) — so it is re-exported rather than redeclared. From
// `@legal-ai/core-client` and not `@legal-ai/db`: convention 6 says vocabulary
// belongs to the package that owns the value, and the core owns this one.
// Re-exported at all so that a component keeps importing `../api` and never
// learns which package the word came from — the point of the convention is
// that moving it again is this file's diff and nobody else's.
//
// `trace_version` has no view-model counterpart on purpose. It tells a reader
// of an archived trace which shape to expect; a screen rendering the trace it
// just fetched already knows, and a field nothing renders would be a field the
// mapper has to keep truthful for no one.

import type { BlockTrust } from "@legal-ai/core-client";

export type { BlockTrust } from "@legal-ai/core-client";

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
