// The mechanism ADR-0021 exists for: proof that the hand-written types and the
// hand-written schema still say the same thing.
//
// Read the five groups below as one argument.
//
//   1. The schema accepts real wire data           — the valid fixture.
//   2. The schema rejects what it claims to reject  — one case per constraint.
//   3. The schema and the TypeScript agree          — the bridges.
//   4. Nothing here is silently unexercised         — the coverage assertions.
//   5. What the schema cannot say                   — the id resolution check.
//
// Group 3 is the load-bearing one and the reason this file is not just "does the
// fixture validate". A fixture can satisfy both a type and a schema that
// disagree with each other; ADR-0021 §3 has the worked counterexample.
//
// Group 5 is new with the frozen field list. A block cites norms by id into the
// trace's own `law_refs`, and JSON Schema has no way to say that an id resolves.
// A dangling reference would validate cleanly and then render as a missing
// citation — so it is asserted here instead, and named in `README.md` as one of
// the things the contract cannot prove about itself.
//
// **This file is only half the gate, and the half it is not matters.** Vitest
// transpiles types away without checking them, so the exhaustiveness assertions
// below are inert under `pnpm test` and only fire under `pnpm typecheck`. Both
// commands are therefore part of the verification, and the four cases run by
// hand whenever the bridges change are:
//
//   a value added to a schema enum only          -> `pnpm test` red
//   a value added to a bridge constant only      -> `pnpm test` red
//   a property added to the schema only          -> `pnpm test` red
//   a property added to the interface only       -> `pnpm typecheck` red
//
// The fourth is the one that would be missed by trusting the test runner alone.
// A bridge nobody has seen fail is a bridge nobody has evidence for.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BLOCK_CONDITION_KEYS,
  BLOCK_TRUST,
  GENERATION_TRACE_KEYS,
  LAW_REF_KEYS,
  LAW_SOURCE,
  TOOL_CALL_KEYS,
  TOOL_OUTCOME,
  TRACE_BLOCK_KEYS,
  type BlockConditionKeysAreExhaustive,
  type GenerationTrace,
  type GenerationTraceKeysAreExhaustive,
  type LawRefKeysAreExhaustive,
  type ToolCallKeysAreExhaustive,
  type TraceBlockKeysAreExhaustive,
} from "./trace.ts";

// `readFileSync`, not `import`: a `.json` import anywhere reachable from
// `index.ts` would make this package unimportable from the Deno gateway, and a
// rule that holds everywhere except in tests is a rule with an exception nobody
// remembers. See ADR-0021 §8.
function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

interface JsonSchemaObject {
  type?: string | string[];
  enum?: string[];
  const?: unknown;
  pattern?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  $defs?: Record<string, JsonSchemaObject>;
}

const traceSchema = readJson("../schema/trace.schema.json") as JsonSchemaObject;
const validTrace = readJson("../fixtures/trace.valid.json") as GenerationTrace;
const invalidTraces = readJson("../fixtures/trace.invalid.json") as {
  cases: { name: string; constraint: string; value: unknown }[];
};

// ajv 8 is CommonJS, so the ESM default import can arrive either as the
// constructor or wrapped in `.default` depending on who did the interop.
const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;

// `strict` stays ON. That is the whole reason ADR-0021 chose plain JSON Schema
// over an OpenAPI document: against an OpenAPI wrapper ajv needs `strict: false`
// or a vocabulary whitelist, and `strict: false` switches off the check that
// catches a misspelled `additionalProperies` — the exact keyword every argument
// below rests on.
const ajv = new AjvCtor({ allErrors: true });
const validateTrace = ajv.compile(traceSchema);

/** Validates what would actually cross the wire, not the in-memory object. */
function validateAsWire(value: unknown): { ok: boolean; keywords: string[] } {
  const ok = validateTrace(JSON.parse(JSON.stringify(value))) as boolean;
  return { ok, keywords: (validateTrace.errors ?? []).map((error) => error.keyword) };
}

function def(name: string): JsonSchemaObject | undefined {
  return traceSchema.$defs?.[name];
}

describe("the schema accepts what the core will send", () => {
  it("validates the reference trace", () => {
    const { ok, keywords } = validateAsWire(validTrace);
    expect(keywords).toEqual([]);
    expect(ok).toBe(true);
  });

  it("accepts a value TypeScript considers well-typed", () => {
    // The direction the JSON fixtures cannot cover: `tsc` checks this literal,
    // ajv checks its serialisation. A field TypeScript allows and the schema
    // forbids fails here.
    const sample = {
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
      ],
      blocks: [
        {
          id: "blk-header",
          title: "Court header and parties",
          trust: "lawyer_edited",
          needs_attention: false,
          selected_by: { expression: "always", field_keys: [] },
          law_ref_ids: ["norm-family-112"],
          questionnaire_fields: ["applicant_name"],
          tool_calls: [
            { tool: "draft_narrative", started_at: "2026-08-26T09:41:07.250Z", outcome: "ok" },
          ],
        },
      ],
    } satisfies GenerationTrace;

    expect(validateAsWire(sample).ok).toBe(true);
  });
});

describe("the schema rejects what it claims to reject", () => {
  // The other half. A validator that accepts everything passes the group above
  // and fails here, which is the only way to tell the two apart.
  it.each(invalidTraces.cases)("rejects: $name", ({ constraint, value }) => {
    const { ok, keywords } = validateAsWire(value);
    expect(ok).toBe(false);
    expect(keywords).toContain(constraint);
  });

  it("has a case for every constraint keyword the schema uses", () => {
    // Without this, a constraint could be added to the schema and never given a
    // failing case — the schema would claim to enforce something nothing has
    // watched it enforce.
    //
    // **It counts by exclusion, and the first draft counted by inclusion.** That
    // draft matched each key against a written list of constraint keywords, so
    // adding `maxLength` to the schema left it green: a keyword nobody had
    // thought of was, by construction, not on the list of keywords to check for.
    // The test claimed to guard against unwatched constraints and could only
    // ever see the watched ones. Now anything that is not a known structural or
    // annotation keyword counts as a constraint, so a keyword nobody has thought
    // of fails until somebody writes its case — which is the direction a gate
    // has to fail in.
    const ANNOTATIONS = new Set(["$schema", "$id", "$ref", "title", "description", "comment"]);
    const SCHEMA_MAPS = new Set(["properties", "$defs"]); // keys are names, values are schemas
    const SCHEMA_VALUES = new Set(["items"]); // the value is one schema
    const SCHEMA_LISTS = new Set(["oneOf", "anyOf", "allOf"]); // constrains, and holds schemas

    const constrained = new Set<string>();
    const walk = (node: unknown): void => {
      if (node === null || typeof node !== "object" || Array.isArray(node)) return;
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (ANNOTATIONS.has(key)) continue;
        if (SCHEMA_MAPS.has(key)) {
          Object.values(child as Record<string, unknown>).forEach(walk);
          continue;
        }
        if (SCHEMA_VALUES.has(key)) {
          walk(child);
          continue;
        }
        constrained.add(key);
        if (SCHEMA_LISTS.has(key)) (child as unknown[]).forEach(walk);
      }
    };
    walk(traceSchema);

    const exercised = new Set(invalidTraces.cases.map((testCase) => testCase.constraint));
    expect([...constrained].sort()).toEqual([...exercised].sort());
  });
});

describe("the schema and the TypeScript agree", () => {
  it.each([
    ["BlockTrust", BLOCK_TRUST],
    ["LawSource", LAW_SOURCE],
    ["ToolOutcome", TOOL_OUTCOME],
  ])("pins the %s values on both sides", (name, constant) => {
    expect([...(def(name)?.enum ?? [])].sort()).toEqual([...constant].sort());
  });

  it("pins the trace's property names on both sides", () => {
    expect(Object.keys(traceSchema.properties ?? {}).sort()).toEqual(
      [...GENERATION_TRACE_KEYS].sort(),
    );
    expect([...(traceSchema.required ?? [])].sort()).toEqual([...GENERATION_TRACE_KEYS].sort());
  });

  it.each([
    ["TraceBlock", TRACE_BLOCK_KEYS],
    ["LawRef", LAW_REF_KEYS],
    ["BlockCondition", BLOCK_CONDITION_KEYS],
    ["ToolCall", TOOL_CALL_KEYS],
  ])("pins %s's property names on both sides", (name, keys) => {
    expect(Object.keys(def(name)?.properties ?? {}).sort()).toEqual([...keys].sort());
    expect([...(def(name)?.required ?? [])].sort()).toEqual([...keys].sort());
  });

  it("lists every property of every type, with none missing", () => {
    // Compile-time, not runtime: these types are `never` if a key of the
    // interface is absent from its `*_KEYS` array, and `satisfies never` does
    // not compile. `satisfies` rather than an unused variable so the assertion
    // is a value the file actually uses.
    expect(true satisfies GenerationTraceKeysAreExhaustive).toBe(true);
    expect(true satisfies TraceBlockKeysAreExhaustive).toBe(true);
    expect(true satisfies LawRefKeysAreExhaustive).toBe(true);
    expect(true satisfies BlockConditionKeysAreExhaustive).toBe(true);
    expect(true satisfies ToolCallKeysAreExhaustive).toBe(true);
  });

  it("closes every object it defines", () => {
    // Without this the key bridges above prove nothing: a schema that permits
    // extra properties would accept a TypeScript type with fields it has never
    // heard of. Asserted over every object `$def` rather than a written list,
    // so a new one cannot arrive open.
    expect(traceSchema.additionalProperties).toBe(false);
    for (const [name, schema] of Object.entries(traceSchema.$defs ?? {})) {
      if (schema.type === "object") {
        expect(schema.additionalProperties, `${name} is left open`).toBe(false);
      }
    }
  });
});

describe("nothing here is silently unexercised", () => {
  it("exercises every schema the file defines", () => {
    // An unexercised type must fail rather than pass quietly. When a `$def` is
    // added, this goes red until a fixture reaches it.
    expect(Object.keys(traceSchema.$defs ?? {}).sort()).toEqual([
      "BlockCondition",
      "BlockTrust",
      "Instant",
      "LawRef",
      "LawSource",
      "ToolCall",
      "ToolOutcome",
      "TraceBlock",
    ]);
  });

  it("exercises every trust value at least once", () => {
    // Guards the leak that motivated the bridges: an enum member no fixture
    // carries is one no test can notice going wrong.
    const used = new Set(validTrace.blocks.map((block) => block.trust));
    expect([...used].sort()).toEqual([...BLOCK_TRUST].sort());
  });

  it("exercises every tool outcome at least once", () => {
    const used = new Set(validTrace.blocks.flatMap((b) => b.tool_calls).map((c) => c.outcome));
    expect([...used].sort()).toEqual([...TOOL_OUTCOME].sort());
  });

  it("exercises every law source at least once", () => {
    const used = new Set(validTrace.law_refs.map((ref) => ref.source));
    expect([...used].sort()).toEqual([...LAW_SOURCE].sort());
  });

  it("exercises both sides of every nullable field", () => {
    // A `| null` that is never null in any fixture, or never non-null, is half
    // a field. `article === null` in particular is not an absence — it is how
    // the contract says "the whole act", so a fixture without one never
    // exercises act scope at all.
    const articles = validTrace.law_refs.map((ref) => ref.article);
    expect(articles).toContain(null);
    expect(articles.some((article) => article !== null)).toBe(true);

    const verified = validTrace.law_refs.map((ref) => ref.verified_at);
    expect(verified).toContain(null);
    expect(verified.some((instant) => instant !== null)).toBe(true);

    const conditions = validTrace.blocks.map((block) => block.selected_by);
    expect(conditions).toContain(null);
    expect(conditions.some((condition) => condition !== null)).toBe(true);
  });

  it("exercises every array both empty and non-empty", () => {
    // An array that is `[]` in every fixture never has its `items` schema run;
    // one that is never empty never proves empty is legal.
    const arrays: [string, unknown[][]][] = [
      ["law_ref_ids", validTrace.blocks.map((block) => block.law_ref_ids)],
      ["questionnaire_fields", validTrace.blocks.map((block) => block.questionnaire_fields)],
      ["tool_calls", validTrace.blocks.map((block) => block.tool_calls)],
      [
        "field_keys",
        validTrace.blocks
          .map((block) => block.selected_by)
          .filter((condition) => condition !== null)
          .map((condition) => condition.field_keys),
      ],
    ];
    for (const [name, instances] of arrays) {
      expect(
        instances.some((items) => items.length === 0),
        `${name} is never empty`,
      ).toBe(true);
      expect(
        instances.some((items) => items.length > 0),
        `${name} is never populated`,
      ).toBe(true);
    }
  });

  it("exercises an instant with and without milliseconds", () => {
    // The `Instant` pattern makes milliseconds optional. Both branches of that
    // `?` need a fixture, or one of them is a claim nothing has run.
    const instants = [
      ...validTrace.law_refs.map((ref) => ref.verified_at),
      ...validTrace.blocks.flatMap((block) => block.tool_calls).map((call) => call.started_at),
    ].filter((instant): instant is string => instant !== null);

    expect(instants.some((instant) => instant.includes("."))).toBe(true);
    expect(instants.some((instant) => !instant.includes("."))).toBe(true);
  });
});

describe("what the schema cannot say", () => {
  it("resolves every law_ref_id against the trace's own register", () => {
    // JSON Schema has no cross-reference constraint, so a block citing a norm
    // the trace does not carry validates cleanly and then renders as a citation
    // that is not there. This is the check standing in for the one the schema
    // cannot express — and the reason the ids are worth the indirection at all
    // is that the alternative, inline copies, has a failure the schema cannot
    // express either: two copies of one norm disagreeing.
    const known = new Set(validTrace.law_refs.map((ref) => ref.norm_id));
    const cited = validTrace.blocks.flatMap((block) => block.law_ref_ids);

    expect(cited.filter((id) => !known.has(id))).toEqual([]);
  });

  it("carries no norm in the register that no block cites", () => {
    // The other direction, and a weaker claim: an unreferenced entry is not
    // wrong on the wire, it is dead weight the console would render nowhere.
    // Asserted about the fixture so that one arriving is deliberate.
    const cited = new Set(validTrace.blocks.flatMap((block) => block.law_ref_ids));

    expect(validTrace.law_refs.filter((ref) => !cited.has(ref.norm_id))).toEqual([]);
  });

  it("lists each norm exactly once", () => {
    const ids = validTrace.law_refs.map((ref) => ref.norm_id);
    expect(ids).toEqual([...new Set(ids)]);
  });
});
