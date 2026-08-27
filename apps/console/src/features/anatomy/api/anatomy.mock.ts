// Fixture implementation of AnatomyApi.
//
// **Why the fixture is here and not in `shared/api/fixture-store`.** That file
// says what it is in its first line: the stand-in for the *database*, shared so
// that a write through one feature is visible to another. A trace is not a row
// — no table produces it, no other feature reads it, and nothing writes it —
// so putting it in the row store would claim a relationship that does not
// exist. It lived in `packages/db` until 2026-08-28 under a comment admitting
// as much; ADR-0021 §5 gave it a home and this is the move.
//
// **Why it is not in `packages/core-client` either, yet.** It will be: ADM-3's
// last pass ships a `CoreClient` interface with a fixture implementation typed
// as it, and then this file delegates instead of holding data. Putting the
// fixture in the package before the interface exists would be putting it
// nowhere in particular — and the package is read by a Deno gateway, so a
// fixture there has to answer questions about import attributes that a fixture
// here does not (ADR-0021 §8).
//
// The shape is `GenerationTrace` from the contract, so it is snake_case and
// the same data as `packages/core-client/fixtures/trace.valid.json` — which
// ajv validates against the schema. Two copies of one trace is a real cost,
// paid until the fixture client lands and there is one; the alternative today
// is importing JSON into the package's graph, which is the thing ADR-0021 §8
// forbids.
//
// There is exactly one hand-written trace, seeded for `svc-divorce`, and it is
// returned regardless of which id was asked for. Throwing `not_found` for every
// other id would be inventing a decision nobody has made yet: the real
// implementation, reading a trace the core actually produced for the requested
// service, is what gets to decide what a missing one means.

import type { GenerationTrace, TraceBlock } from "@legal-ai/core-client";
import { fixtureDelay } from "../../../shared/api/fixture-store";
import type { AnatomyApi } from "./contract";
import type { GenerationTraceView, TraceBlockView } from "./types";

const fixtureTrace: GenerationTrace = {
  trace_version: 1,
  service_id: "svc-divorce",
  blocks: [
    {
      id: "blk-header",
      title: "Court header and parties",
      trust: "template",
      needs_attention: false,
      law_refs: [],
      questionnaire_fields: ["applicant_name", "respondent_name", "court_region"],
    },
    {
      id: "blk-circumstances",
      title: "Circumstances of the marriage",
      trust: "ai_generated",
      needs_attention: true,
      law_refs: [],
      questionnaire_fields: ["marriage_date", "children", "separation_reason"],
    },
    {
      id: "blk-legal-grounds",
      title: "Legal grounds",
      trust: "ai_generated",
      needs_attention: false,
      law_refs: ["Family Code of Ukraine, art. 112"],
      questionnaire_fields: [],
    },
    {
      id: "blk-request",
      title: "Request to the court",
      trust: "lawyer_edited",
      needs_attention: false,
      law_refs: [],
      questionnaire_fields: ["applicant_name"],
    },
  ],
};

// The arrays are copied rather than passed through. A view model handing out a
// reference into the fixture lets a component's `.sort()` rewrite the source,
// and the next caller gets the mutated one — a bug no real implementation
// could have, so a fixture that permits it teaches the wrong lesson.
function toBlockView(block: TraceBlock): TraceBlockView {
  return {
    id: block.id,
    title: block.title,
    trust: block.trust,
    needsAttention: block.needs_attention,
    lawRefs: [...block.law_refs],
    questionnaireFields: [...block.questionnaire_fields],
  };
}

export function toTraceView(trace: GenerationTrace): GenerationTraceView {
  return {
    serviceId: trace.service_id,
    blocks: trace.blocks.map(toBlockView),
  };
}

export const mockAnatomyApi: AnatomyApi = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see file comment: one fixture trace, not yet selected by id
  async getTrace(serviceId) {
    await fixtureDelay();
    return toTraceView(fixtureTrace);
  },
};
