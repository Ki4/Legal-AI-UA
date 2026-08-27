// What this pins is the seam the trace's move created.
//
// Until 2026-08-28 the trace was camelCase in `packages/db` and this layer's
// mapper was a field-for-field copy — there was nothing for a test to be wrong
// about. The contract is snake_case now (ADR-0021 §6), so the mapper renames
// fields across a boundary between two packages, and a rename is exactly the
// kind of code that compiles while being wrong: `tsc` proves every camelCase
// key was produced, and says nothing about which snake_case field each one was
// read from.
//
// The field freeze added a second job on the same seam. A block cites norms by
// id into the trace's own register, so this layer resolves them — and an id
// that resolves to nothing is a case JSON Schema cannot forbid and this mapper
// has to decide about. Both halves are below.
//
// **The sample has three blocks and the count is the design.** ADR-0021 §3's
// argument arrives one level down here: a sample where two fields happen to
// move together cannot tell which of them was read. One block, with
// `needs_attention: true` beside a non-empty citation list, let
// `needsAttention: block.law_ref_ids.length > 0` go green. Two blocks with the
// opposite pairing fixed that and let the *inverted* reading through instead —
// with one boolean varying across two rows, any other varying binary is either
// perfectly correlated with it or perfectly anti-correlated, so exactly one of
// the two derivations always survives. Three rows are the fewest that break
// both: two need attention and disagree about whether they cite anything, and
// the third needs none. The strings are all distinct for the same reason, so a
// swapped `id`/`title` has nowhere to hide either.
//
// Verified by watching it fail, not by reading it: defects were injected one at
// a time — wrong readings of `needs_attention`, an `id`/`title` swap, a spread
// mapper, arrays handed out by reference, a fixture dropping a trust value, a
// hardcoded `serviceId`, and a resolver that drops what it cannot resolve — and
// each turned this file red. The two named above are the ones that got through
// earlier drafts.

import { BLOCK_TRUST, type GenerationTrace, type LawRef } from "@legal-ai/core-client";
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

const articleNorm: LawRef = {
  norm_id: "norm-article",
  source: "zakon_rada",
  act_id: "2947-14",
  act_title: "Family Code of Ukraine",
  article: "112",
  relied_on: "Grounds on which a court dissolves a marriage.",
  verified_at: "2026-08-20T06:15:00Z",
};

const actNorm: LawRef = {
  norm_id: "norm-act",
  source: "zakon_rada",
  act_id: "1618-15",
  act_title: "Civil Procedure Code of Ukraine",
  article: null,
  relied_on: "Form and content of a claim.",
  verified_at: null,
};

const sample: GenerationTrace = {
  trace_version: 1,
  service_id: "svc-under-test",
  law_refs: [articleNorm, actNorm],
  blocks: [
    {
      id: "blk-flagged",
      title: "Flagged, cites nothing, asks two questions",
      trust: "ai_generated",
      needs_attention: true,
      selected_by: null,
      law_ref_ids: [],
      questionnaire_fields: ["applicant_name", "court_region"],
      tool_calls: [],
    },
    {
      id: "blk-settled",
      title: "Settled, cites one norm, asks nothing",
      trust: "lawyer_edited",
      needs_attention: false,
      selected_by: { expression: "children is empty", field_keys: ["children"] },
      law_ref_ids: ["norm-article"],
      questionnaire_fields: [],
      tool_calls: [
        { tool: "retrieve_norm_text", started_at: "2026-08-26T09:41:11Z", outcome: "ok" },
      ],
    },
    {
      id: "blk-flagged-with-a-ref",
      title: "Flagged, cites the act as a whole, asks nothing",
      trust: "template",
      needs_attention: true,
      selected_by: null,
      law_ref_ids: ["norm-act"],
      questionnaire_fields: [],
      tool_calls: [],
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
        lawRefs: [{ normId: "norm-article", actTitle: "Family Code of Ukraine", article: "112" }],
        questionnaireFields: [],
      },
      {
        id: "blk-flagged-with-a-ref",
        title: "Flagged, cites the act as a whole, asks nothing",
        trust: "template",
        needsAttention: true,
        lawRefs: [
          { normId: "norm-act", actTitle: "Civil Procedure Code of Ukraine", article: null },
        ],
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
    expect(Object.keys(at(at(view.blocks, 1).lawRefs, 0)).sort()).toEqual([
      "actTitle",
      "article",
      "normId",
    ]);
  });

  it("copies the arrays instead of handing out the source", () => {
    const view = toTraceView(sample);
    at(view.blocks, 0).questionnaireFields.push("invented by a component");
    at(view.blocks, 1).lawRefs.push({ normId: "x", actTitle: "x", article: null });

    expect(at(sample.blocks, 0).questionnaire_fields).toEqual(["applicant_name", "court_region"]);
    expect(at(sample.blocks, 1).law_ref_ids).toEqual(["norm-article"]);
  });

  it("maps a trace with no blocks to a view with no blocks", () => {
    expect(toTraceView({ ...sample, blocks: [] })).toEqual({
      serviceId: "svc-under-test",
      blocks: [],
    });
  });
});

describe("resolving a block's citations against the register", () => {
  it("gives one norm the same reading in every block that cites it", () => {
    // The whole reason the wire carries ids rather than inline copies: four
    // blocks citing one article must not be able to describe it four ways.
    const shared: GenerationTrace = {
      ...sample,
      blocks: sample.blocks.map((block) => ({ ...block, law_ref_ids: ["norm-article"] })),
    };

    const readings = toTraceView(shared).blocks.map((block) => at(block.lawRefs, 0));
    expect(new Set(readings.map((ref) => JSON.stringify(ref))).size).toBe(1);
  });

  it("preserves the order a block cites its norms in", () => {
    const bothWays: GenerationTrace = {
      ...sample,
      blocks: [
        { ...at(sample.blocks, 1), law_ref_ids: ["norm-act", "norm-article"] },
        { ...at(sample.blocks, 2), law_ref_ids: ["norm-article", "norm-act"] },
      ],
    };

    const view = toTraceView(bothWays);
    expect(at(view.blocks, 0).lawRefs.map((ref) => ref.normId)).toEqual([
      "norm-act",
      "norm-article",
    ]);
    expect(at(view.blocks, 1).lawRefs.map((ref) => ref.normId)).toEqual([
      "norm-article",
      "norm-act",
    ]);
  });

  // The case the schema cannot forbid. Dropping it would tell a lawyer the
  // block rests on nothing — a falsehood stated confidently — so it renders as
  // itself instead, which is visibly odd (DoD §5).
  it("renders an id the register does not answer to as itself, rather than dropping it", () => {
    const dangling: GenerationTrace = {
      ...sample,
      blocks: [{ ...at(sample.blocks, 1), law_ref_ids: ["norm-article", "norm-vanished"] }],
    };

    expect(at(toTraceView(dangling).blocks, 0).lawRefs).toEqual([
      { normId: "norm-article", actTitle: "Family Code of Ukraine", article: "112" },
      { normId: "norm-vanished", actTitle: "norm-vanished", article: null },
    ]);
  });

  it("ignores a register entry no block cites", () => {
    const spare: GenerationTrace = {
      ...sample,
      law_refs: [
        ...sample.law_refs,
        { ...articleNorm, norm_id: "norm-unused", act_title: "Nobody cites this" },
      ],
    };

    const titles = toTraceView(spare).blocks.flatMap((block) =>
      block.lawRefs.map((ref) => ref.actTitle),
    );
    expect(titles).not.toContain("Nobody cites this");
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

  it("exercises both an article-scoped and an act-scoped citation", async () => {
    // `article: null` is not an absence — it is how the contract says "the
    // whole act", and `AnatomyPage` renders it as the bare title. A fixture
    // without one never renders that branch.
    const refs = (await mockAnatomyApi.getTrace("svc-divorce")).blocks.flatMap(
      (block) => block.lawRefs,
    );

    expect(refs.some((ref) => ref.article === null)).toBe(true);
    expect(refs.some((ref) => ref.article !== null)).toBe(true);
  });

  it("resolves every citation in the seeded trace", async () => {
    const refs = (await mockAnatomyApi.getTrace("svc-divorce")).blocks.flatMap(
      (block) => block.lawRefs,
    );

    expect(refs.filter((ref) => ref.actTitle === ref.normId)).toEqual([]);
  });

  it("does not let one caller's mutation reach the next", async () => {
    const first = await mockAnatomyApi.getTrace("svc-divorce");
    first.blocks.length = 0;

    expect((await mockAnatomyApi.getTrace("svc-divorce")).blocks).not.toHaveLength(0);
  });
});
