// Fixture implementation of AnatomyApi.
//
// The only file allowed to know `mockTrace` and `BlockTrust` exist as
// `@legal-ai/db` exports (ADR-0012, convention 4 and 6) — everything past
// this file sees `GenerationTraceView`.
//
// There is exactly one hand-written trace, seeded for `svc-divorce`
// (packages/db/src/mocks.ts), and it is returned regardless of which id was
// asked for. Throwing `not_found` for every other id would be inventing a
// decision nobody has made yet: the real implementation, reading a trace the
// core actually produced for the requested service, is what gets to decide
// what a missing one means.

import type { GenerationTrace, TraceBlock } from "@legal-ai/db";
import { mockTrace } from "@legal-ai/db";
import { fixtureDelay } from "../../../shared/api/fixture-store";
import type { AnatomyApi } from "./contract";
import type { GenerationTraceView, TraceBlockView } from "./types";

function toBlockView(block: TraceBlock): TraceBlockView {
  return {
    id: block.id,
    title: block.title,
    trust: block.trust,
    needsAttention: block.needsAttention,
    lawRefs: block.lawRefs,
    questionnaireFields: block.questionnaireFields,
  };
}

function toTraceView(trace: GenerationTrace): GenerationTraceView {
  return {
    serviceId: trace.serviceId,
    blocks: trace.blocks.map(toBlockView),
  };
}

export const mockAnatomyApi: AnatomyApi = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see file comment: one fixture trace, not yet selected by id
  async getTrace(serviceId) {
    await fixtureDelay();
    return toTraceView(mockTrace);
  },
};
