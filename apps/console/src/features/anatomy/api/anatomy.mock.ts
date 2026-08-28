// Fixture implementation of AnatomyApi.
//
// **The trace is not here.** It is `fixtureTrace` in `packages/core-client`,
// beside the contract it conforms to, and a test there compares it against
// `fixtures/trace.valid.json` — the file ajv validates. This screen holds a
// mapper and no data. Until 2026-08-28 it held a copy of that trace instead,
// which nothing validated and nothing compared; ADM-3's fifth pass is what
// removed it.
//
// **Why the data could not simply live in the JSON file everything reads.**
// Nothing on `core-client`'s `index.ts` graph may read a file: the Deno gateway
// imports that barrel, and a bare `.json` import is rejected there outright
// (ADR-0021 §8). So a runtime copy has to exist somewhere; what changed is that
// there is now one of them and a test watching it.
//
// **Why this file does not call `createFixtureCoreClient`.** That client
// generates a trace — it starts a job and polls it. This screen reads one that
// already exists, which is a different question, and answering it by running a
// generation would teach the screen a workflow it does not have. The real
// implementation reads a stored trace; the fixture reads a stored trace.
//
// There is exactly one trace, seeded for `svc-divorce`, and it is returned
// regardless of which id was asked for. Throwing `not_found` for every other id
// would be inventing a decision nobody has made yet: the real implementation,
// reading a trace the core actually produced for the requested service, is what
// gets to decide what a missing one means.

import { fixtureTrace } from "@legal-ai/core-client";
import type { GenerationTrace, LawRef, TraceBlock } from "@legal-ai/core-client";
import { fixtureDelay } from "../../../shared/api/fixture-store";
import type { AnatomyApi } from "./contract";
import type { GenerationTraceView, LawRefView, TraceBlockView } from "./types";

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
