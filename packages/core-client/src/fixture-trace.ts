// The reference trace, as the runtime sees it.
//
// **Why this exists beside `fixtures/trace.valid.json` rather than instead of
// it.** The JSON file is the one ajv validates and the one the Python lane will
// validate too (ADR-0021 §4) — it is the fixture's authority. But nothing on
// `index.ts`'s graph may read it: `readFileSync` is unavailable to the Deno
// gateway and a bare `.json` import is rejected outright (ADR-0021 §8). So a
// runtime copy is unavoidable, and the question is only whether anything watches
// it. `fixture-client.test.ts` compares this constant against that file, which
// is what turns a second copy into a checked one.
//
// **It replaces a third copy that nothing watched.** Until this landed the same
// trace was also spelled out in `apps/console/src/features/anatomy/api/
// anatomy.mock.ts`, where no schema and no test reached it — the debt recorded
// on 2026-08-28. That file now imports this constant.
//
// The data is deliberately awkward in the places a screen has to survive: a norm
// that has never been verified, an act-scoped reference with no article, a block
// citing nothing, a block whose tool call failed before it succeeded, an empty
// `field_keys`, and one instant with milliseconds and one without.

import type { GenerationTrace } from "./trace.ts";

export const fixtureTrace: GenerationTrace = {
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
        {
          tool: "retrieve_precedent",
          started_at: "2026-08-26T09:41:02Z",
          outcome: "ok",
        },
        {
          tool: "draft_narrative",
          started_at: "2026-08-26T09:41:07.250Z",
          outcome: "ok",
        },
      ],
    },
    {
      id: "blk-legal-grounds",
      title: "Legal grounds",
      trust: "ai_generated",
      needs_attention: false,
      selected_by: {
        expression: "children is empty",
        field_keys: ["children"],
      },
      law_ref_ids: ["norm-family-112", "norm-family-105"],
      questionnaire_fields: [],
      tool_calls: [
        {
          tool: "retrieve_norm_text",
          started_at: "2026-08-26T09:41:11Z",
          outcome: "error",
        },
        {
          tool: "retrieve_norm_text",
          started_at: "2026-08-26T09:41:13Z",
          outcome: "ok",
        },
      ],
    },
    {
      id: "blk-request",
      title: "Request to the court",
      trust: "lawyer_edited",
      needs_attention: false,
      selected_by: {
        expression: "always",
        field_keys: [],
      },
      law_ref_ids: ["norm-civil-procedure"],
      questionnaire_fields: ["applicant_name"],
      tool_calls: [],
    },
  ],
};
