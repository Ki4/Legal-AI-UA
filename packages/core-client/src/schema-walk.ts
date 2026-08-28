// Reading the schemas from a test, and nothing else.
//
// **Not on `index.ts`'s graph, and it must never be put there.** It reaches for
// `node:fs`, which the Deno gateway that imports this package's barrel cannot be
// asked to provide — the same rule that keeps `.json` imports out of `src/`
// (ADR-0021 §8, `README.md`). Nothing here is exported from the barrel; it is
// imported by `schema.test.ts` and `protocol.test.ts` and by nothing else.
//
// It exists because those two files were about to hold the same thirty-line
// keyword walker twice, and a checker duplicated is a checker that gets fixed in
// one copy.

import { readFileSync } from "node:fs";

/** The subset of JSON Schema this package's assertions actually look at. */
export interface JsonSchemaObject {
  type?: string | string[];
  enum?: string[];
  const?: unknown;
  pattern?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  $defs?: Record<string, JsonSchemaObject>;
}

/**
 * `readFileSync`, not `import`: a `.json` import anywhere reachable from
 * `index.ts` would make this package unimportable from the Deno gateway, and a
 * rule that holds everywhere except in tests is a rule with an exception nobody
 * remembers. See ADR-0021 §8.
 */
export function readJson(relativePath: string, base: string | URL): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, base), "utf8"));
}

/**
 * Every keyword in a schema that constrains a value, as a sorted list.
 *
 * **It counts by exclusion, and the first draft counted by inclusion.** That
 * draft matched each key against a written list of constraint keywords, so
 * adding `maxLength` to a schema left it green: a keyword nobody had thought of
 * was, by construction, not on the list of keywords to check for. The test
 * claimed to guard against unwatched constraints and could only ever see the
 * watched ones. Now anything that is not a known structural or annotation
 * keyword counts as a constraint, so a keyword nobody has thought of fails until
 * somebody writes its case — which is the direction a gate has to fail in.
 *
 * `$ref` is an annotation here, so the walk stops at a schema's own edges: a
 * constraint in a file this one points at is that file's test's business.
 */
export function constraintKeywords(schema: unknown): string[] {
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
  walk(schema);

  return [...constrained].sort();
}
