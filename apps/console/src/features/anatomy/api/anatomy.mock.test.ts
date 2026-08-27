// What this pins is the seam the trace's move created.
//
// Until 2026-08-28 the trace was camelCase in `packages/db` and this layer's
// mapper was a field-for-field copy — there was nothing for a test to be wrong
// about. The contract is snake_case now (ADR-0021 §6), so the mapper renames
// six fields across a boundary between two packages, and a rename is exactly
// the kind of code that compiles while being wrong: `tsc` proves every
// camelCase key was produced, and says nothing about which snake_case field
// each one was read from.
//
// **The sample below has three blocks and the count is the design.** ADR-0021
// §3's argument arrives one level down here: a sample where two fields happen
// to move together cannot tell which of them was read. One block, with
// `needs_attention: true` beside a non-empty `law_refs`, let
// `needsAttention: block.law_refs.length > 0` go green. Two blocks with the
// opposite pairing fixed that and let the *inverted* reading through instead —
// with one boolean varying across two rows, any other varying binary is either
// perfectly correlated with it or perfectly anti-correlated, so exactly one of
// the two derivations always survives. Three rows are the fewest that break
// both: two need attention and disagree about whether they cite anything, and
// the third needs none. The strings are all distinct for the same reason, so a
// swapped `id`/`title` or `law_refs`/`questionnaire_fields` has nowhere to hide
// either.
//
// Verified by watching it fail, not by reading it: thirteen defects were
// injected one at a time — seven wrong readings of `needs_attention`, an
// `id`/`title` swap, a `law_refs`/`questionnaire_fields` swap, a spread mapper,
// arrays handed out by reference, a fixture dropping a trust value, and a
// hardcoded `serviceId` — and each turned this file red. The two that got
// through the earlier drafts are the two named above.

import { BLOCK_TRUST, type GenerationTrace } from "@legal-ai/core-client";
import { describe, expect, it } from "vitest";
import { mockAnatomyApi, toTraceView } from "./anatomy.mock";

// `noUncheckedIndexedAccess` is on repo-wide, so `blocks[0]` is
// `TraceBlock | undefined`. Throwing here rather than asserting non-null keeps
// a sample that lost a block a named failure instead of a `TypeError` three
// lines later.
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`expected an item at ${index}, got none`);
  return item;
}

const sample: GenerationTrace = {
  trace_version: 1,
  service_id: "svc-under-test",
  blocks: [
    {
      id: "blk-flagged",
      title: "Flagged, cites nothing, asks two questions",
      trust: "ai_generated",
      needs_attention: true,
      law_refs: [],
      questionnaire_fields: ["applicant_name", "court_region"],
    },
    {
      id: "blk-settled",
      title: "Settled, cites one norm, asks nothing",
      trust: "lawyer_edited",
      needs_attention: false,
      law_refs: ["Family Code of Ukraine, art. 112"],
      questionnaire_fields: [],
    },
    {
      id: "blk-flagged-with-a-ref",
      title: "Flagged, cites one norm, asks nothing",
      trust: "template",
      needs_attention: true,
      law_refs: ["Family Code of Ukraine, art. 105"],
      questionnaire_fields: [],
    },
  ],
};

describe("toTraceView", () => {
  it("reads each camelCase field from the snake_case one it renames", () => {
    const view = toTraceView(sample);

    expect(view.serviceId).toBe("svc-under-test");
    expect(view.blocks).toEqual([
      {
        id: "blk-flagged",
        title: "Flagged, cites nothing, asks two questions",
        trust: "ai_generated",
        needsAttention: true,
        lawRefs: [],
        questionnaireFields: ["applicant_name", "court_region"],
      },
      {
        id: "blk-settled",
        title: "Settled, cites one norm, asks nothing",
        trust: "lawyer_edited",
        needsAttention: false,
        lawRefs: ["Family Code of Ukraine, art. 112"],
        questionnaireFields: [],
      },
      {
        id: "blk-flagged-with-a-ref",
        title: "Flagged, cites one norm, asks nothing",
        trust: "template",
        needsAttention: true,
        lawRefs: ["Family Code of Ukraine, art. 105"],
        questionnaireFields: [],
      },
    ]);
  });

  // The other half. `toEqual` above would pass with a stray `needs_attention`
  // sitting beside `needsAttention` — an excess property survives a spread that
  // an object literal would have been rejected for, and a mapper rewritten as
  // `{ ...block, needsAttention: block.needs_attention }` is the plausible way
  // to get there. So the key set is asserted, not just the values in it.
  it("leaves no wire-shaped key behind", () => {
    const view = toTraceView(sample);

    expect(Object.keys(view).sort()).toEqual(["blocks", "serviceId"]);
    expect(Object.keys(at(view.blocks, 0)).sort()).toEqual([
      "id",
      "lawRefs",
      "needsAttention",
      "questionnaireFields",
      "title",
      "trust",
    ]);
  });

  it("copies the arrays instead of handing out the source", () => {
    const view = toTraceView(sample);
    at(view.blocks, 1).lawRefs.push("invented by a component");
    at(view.blocks, 0).questionnaireFields.push("invented by a component");

    expect(at(sample.blocks, 1).law_refs).toEqual(["Family Code of Ukraine, art. 112"]);
    expect(at(sample.blocks, 0).questionnaire_fields).toEqual(["applicant_name", "court_region"]);
  });

  it("maps a trace with no blocks to a view with no blocks", () => {
    expect(toTraceView({ ...sample, blocks: [] })).toEqual({
      serviceId: "svc-under-test",
      blocks: [],
    });
  });
});

describe("mockAnatomyApi.getTrace", () => {
  it("returns the seeded trace whatever id is asked for", async () => {
    const seeded = await mockAnatomyApi.getTrace("svc-divorce");
    const other = await mockAnatomyApi.getTrace("svc-does-not-exist");

    expect(seeded.serviceId).toBe("svc-divorce");
    expect(other).toEqual(seeded);
  });

  // `AnatomyPage` looks each block's trust up in a `Record<BlockTrust, …>`. A
  // fixture using two of the three values would leave the third's rendering
  // built and never seen, which is the failure ADR-0021 §3 describes for the
  // schema side and the same one applies here.
  it("exercises every trust value the contract allows", async () => {
    const trace = await mockAnatomyApi.getTrace("svc-divorce");
    const used = new Set(trace.blocks.map((block) => block.trust));

    expect([...used].sort()).toEqual([...BLOCK_TRUST].sort());
  });

  it("does not let one caller's mutation reach the next", async () => {
    const first = await mockAnatomyApi.getTrace("svc-divorce");
    first.blocks.length = 0;

    expect((await mockAnatomyApi.getTrace("svc-divorce")).blocks).not.toHaveLength(0);
  });
});
