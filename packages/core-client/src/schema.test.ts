// The mechanism ADR-0021 exists for: proof that the hand-written types and the
// hand-written schema still say the same thing.
//
// Read the four groups below as one argument.
//
//   1. The schema accepts real wire data           — the valid fixture.
//   2. The schema rejects what it claims to reject  — one case per constraint.
//   3. The schema and the TypeScript agree          — the bridges.
//   4. Nothing here is silently unexercised         — the coverage assertions.
//
// Group 3 is the load-bearing one and the reason this file is not just "does the
// fixture validate". A fixture can satisfy both a type and a schema that
// disagree with each other; ADR-0021 §3 has the worked counterexample.
//
// **This file is only half the gate, and the half it is not matters.** Vitest
// transpiles types away without checking them, so the exhaustiveness assertions
// below are inert under `pnpm test` and only fire under `pnpm typecheck`. Both
// commands are therefore part of the verification, and the four cases that were
// run by hand before this landed were:
//
//   a value added to the schema's enum only      -> `pnpm test` red
//   a value added to `BLOCK_TRUST` only          -> `pnpm test` red
//   a property added to the schema only          -> `pnpm test` red
//   a property added to the interface only       -> `pnpm typecheck` red
//
// The fourth is the one that would be missed by trusting the test runner alone.
// Re-run all four when this file changes: a bridge nobody has seen fail is a
// bridge nobody has evidence for.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import {
  BLOCK_TRUST,
  GENERATION_TRACE_KEYS,
  TRACE_BLOCK_KEYS,
  type GenerationTrace,
  type GenerationTraceKeysAreExhaustive,
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
  type?: string;
  enum?: string[];
  const?: unknown;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  $defs?: Record<string, JsonSchemaObject>;
}

const traceSchema = readJson("../schema/trace.schema.json") as JsonSchemaObject;
const validTrace = readJson("../fixtures/trace.valid.json");
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

const traceBlockSchema = traceSchema.$defs?.TraceBlock;
const blockTrustSchema = traceSchema.$defs?.BlockTrust;

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
      blocks: [
        {
          id: "blk-header",
          title: "Court header and parties",
          trust: "lawyer_edited",
          needs_attention: false,
          law_refs: ["Family Code of Ukraine, art. 112"],
          questionnaire_fields: ["applicant_name"],
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
});

describe("the schema and the TypeScript agree", () => {
  it("pins the trust values on both sides", () => {
    expect([...(blockTrustSchema?.enum ?? [])].sort()).toEqual([...BLOCK_TRUST].sort());
  });

  it("pins the trace's property names on both sides", () => {
    expect(Object.keys(traceSchema.properties ?? {}).sort()).toEqual(
      [...GENERATION_TRACE_KEYS].sort(),
    );
    expect([...(traceSchema.required ?? [])].sort()).toEqual([...GENERATION_TRACE_KEYS].sort());
  });

  it("pins a block's property names on both sides", () => {
    expect(Object.keys(traceBlockSchema?.properties ?? {}).sort()).toEqual(
      [...TRACE_BLOCK_KEYS].sort(),
    );
    expect([...(traceBlockSchema?.required ?? [])].sort()).toEqual([...TRACE_BLOCK_KEYS].sort());
  });

  it("lists every property of every type, with none missing", () => {
    // Compile-time, not runtime: these types are `never` if a key of the
    // interface is absent from its `*_KEYS` array, and `satisfies never` does
    // not compile. `satisfies` rather than an unused variable so the assertion
    // is a value the file actually uses.
    expect(true satisfies TraceBlockKeysAreExhaustive).toBe(true);
    expect(true satisfies GenerationTraceKeysAreExhaustive).toBe(true);
  });

  it("closes every object it defines", () => {
    // Without this the key bridges above prove nothing: a schema that permits
    // extra properties would accept a TypeScript type with fields it has never
    // heard of.
    expect(traceSchema.additionalProperties).toBe(false);
    expect(traceBlockSchema?.additionalProperties).toBe(false);
  });
});

describe("nothing here is silently unexercised", () => {
  it("exercises every schema the file defines", () => {
    // An unexercised type must fail rather than pass quietly. When a `$def` is
    // added, this goes red until a fixture reaches it.
    const defined = Object.keys(traceSchema.$defs ?? {}).sort();
    expect(defined).toEqual(["BlockTrust", "TraceBlock"]);
  });

  it("exercises every trust value at least once", () => {
    // Guards the leak that motivated the bridges: an enum member no fixture
    // carries is one no test can notice going wrong.
    const used = new Set((validTrace as GenerationTrace).blocks.map((block) => block.trust));
    expect([...used].sort()).toEqual([...BLOCK_TRUST].sort());
  });

  it("exercises a non-empty law_refs array", () => {
    // An array that is `[]` in every fixture never has its `items` schema run.
    const blocks = (validTrace as GenerationTrace).blocks;
    expect(blocks.some((block) => block.law_refs.length > 0)).toBe(true);
  });
});
