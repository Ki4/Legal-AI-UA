// Fixture implementation of AnatomyApi.
//
// **Why the fixture is here and not in `shared/api/fixture-store`.** That file
// says what it is in its first line: the stand-in for the *database*, shared so
// that a write through one feature is visible to another. A trace is not a row
// — no table produces it, no other feature reads it, and nothing writes it —
// so putting it in the row store would claim a relationship that does not
// exist. It lived in `packages/db` until 2026-08-28 under a comment admitting
// as much; ADR-0021 §5 gave it a home and this is where it landed.
//
// **Why it is not in `packages/core-client` either, yet.** It will be: ADM-3's
// last pass ships a `CoreClient` interface with a fixture implementation typed
// as it, and then this file delegates instead of holding data. Putting the
// fixture in the package before the interface exists would be putting it
// nowhere in particular — and the package is read by a Deno gateway, so a
// fixture there has to answer questions about import attributes that a fixture
// here does not (ADR-0021 §8).
//
// The shape is `GenerationTrace` from the contract, so it is snake_case and the
// same data as `packages/core-client/fixtures/trace.valid.json` — which ajv
// validates against the schema. Two copies of one trace is a real cost, paid
// until the fixture client lands and there is one; the alternative today is
// importing JSON into the package's graph, which is the thing ADR-0021 §8
// forbids.
//
// There is exactly one hand-written trace, seeded for `svc-divorce`, and it is
// returned regardless of which id was asked for. Throwing `not_found` for every
// other id would be inventing a decision nobody has made yet: the real
// implementation, reading a trace the core actually produced for the requested
// service, is what gets to decide what a missing one means.

import type { GenerationTrace, LawRef, TraceBlock } from "@legal-ai/core-client";
import { fixtureDelay } from "../../../shared/api/fixture-store";
import type { AnatomyApi } from "./contract";
import type { GenerationTraceView, LawRefView, TraceBlockView } from "./types";

const fixtureTrace: GenerationTrace = {
  trace_version: 1,
  service_id: "svc-divorce",
  law_refs: [
    {
      norm_id: "norm-family-112",
      source: "zakon_rada",
      act_id: "2947-14",
      act_title: "Family Code of Ukraine",
      article: "112",
      relied_on: "Grounds on which a court dissolves a marriage.",
      verified_at: "2026-08-20T06:15:00Z",
    },
    {
      norm_id: "norm-family-105",
      source: "zakon_rada",
      act_id: "2947-14",
      act_title: "Family Code of Ukraine",
      article: "105",
      relied_on: "Which body dissolves the marriage, and when it must be the court.",
      verified_at: null,
    },
    {
      norm_id: "norm-civil-procedure",
      source: "zakon_rada",
      act_id: "1618-15",
      act_title: "Civil Procedure Code of Ukraine",
      article: null,
      relied_on: "Form and content of a claim, jurisdiction, and the schedule of court fees.",
      verified_at: "2026-08-25T04:00:00.500Z",
    },
  ],
  blocks: [
    {
      id: "blk-header",
      title: "Court header and parties",
      trust: "template",
      needs_attention: false,
      selected_by: null,
      law_ref_ids: ["norm-civil-procedure"],
      questionnaire_fields: ["applicant_name", "respondent_name", "court_region"],
      tool_calls: [],
    },
    {
      id: "blk-circumstances",
      title: "Circumstances of the marriage",
      trust: "ai_generated",
      needs_attention: true,
      selected_by: null,
      law_ref_ids: [],
      questionnaire_fields: ["marriage_date", "children", "separation_reason"],
      tool_calls: [
        { tool: "retrieve_precedent", started_at: "2026-08-26T09:41:02Z", outcome: "ok" },
        { tool: "draft_narrative", started_at: "2026-08-26T09:41:07.250Z", outcome: "ok" },
      ],
    },
    {
      id: "blk-legal-grounds",
      title: "Legal grounds",
      trust: "ai_generated",
      needs_attention: false,
      selected_by: { expression: "children is empty", field_keys: ["children"] },
      law_ref_ids: ["norm-family-112", "norm-family-105"],
      questionnaire_fields: [],
      tool_calls: [
        { tool: "retrieve_norm_text", started_at: "2026-08-26T09:41:11Z", outcome: "error" },
        { tool: "retrieve_norm_text", started_at: "2026-08-26T09:41:13Z", outcome: "ok" },
      ],
    },
    {
      id: "blk-request",
      title: "Request to the court",
      trust: "lawyer_edited",
      needs_attention: false,
      selected_by: { expression: "always", field_keys: [] },
      law_ref_ids: ["norm-civil-procedure"],
      questionnaire_fields: ["applicant_name"],
      tool_calls: [],
    },
  ],
};

function toLawRefView(ref: LawRef): LawRefView {
  return { normId: ref.norm_id, actTitle: ref.act_title, article: ref.article };
}

/**
 * An id no entry in the register answers to.
 *
 * JSON Schema cannot say that a `law_ref_id` resolves — `schema.test.ts` checks
 * it for the fixtures, and the gateway will check it for real payloads, but
 * neither is this function's guarantee. So this layer decides what a dangling
 * id renders as, and the answer is: as itself. DoD §5 asks that bad data render
 * as visibly odd text rather than take the screen down, and it rules out the
 * quieter option — dropping the citation would tell a lawyer the block rests on
 * nothing, which is a falsehood the screen states confidently.
 */
function toUnresolvedView(normId: string): LawRefView {
  return { normId, actTitle: normId, article: null };
}

// The arrays are copied rather than passed through. A view model handing out a
// reference into the fixture lets a component's `.sort()` rewrite the source,
// and the next caller gets the mutated one — a bug no real implementation
// could have, so a fixture that permits it teaches the wrong lesson.
function toBlockView(block: TraceBlock, register: Map<string, LawRef>): TraceBlockView {
  return {
    id: block.id,
    title: block.title,
    trust: block.trust,
    needsAttention: block.needs_attention,
    lawRefs: block.law_ref_ids.map((normId) => {
      const ref = register.get(normId);
      return ref === undefined ? toUnresolvedView(normId) : toLawRefView(ref);
    }),
    questionnaireFields: [...block.questionnaire_fields],
  };
}

export function toTraceView(trace: GenerationTrace): GenerationTraceView {
  const register = new Map(trace.law_refs.map((ref) => [ref.norm_id, ref]));

  return {
    serviceId: trace.service_id,
    blocks: trace.blocks.map((block) => toBlockView(block, register)),
  };
}

export const mockAnatomyApi: AnatomyApi = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see file comment: one fixture trace, not yet selected by id
  async getTrace(serviceId) {
    await fixtureDelay();
    return toTraceView(fixtureTrace);
  },
};
