// The generation trace, as TypeScript sees it.
//
// `schema/trace.schema.json` is the authority (ADR-0021); this file conforms to
// it and does not define it. Nothing here is generated — the two are held
// together by the bridge constants below and the test that reads them, because
// `tsc` proving a fixture matches this file and ajv proving it matches the
// schema still does not prove the two agree with each other. ADR-0021 §3 has
// the counterexample.
//
// Wire shape, so snake_case (ADR-0021 §6). Absence is `| null`, never an
// optional `?` property: an optional key would make the key set variable, and
// the bridge below is exactly an assertion that it is not.

/**
 * Who wrote a block's text.
 *
 * Declared as an array first so the schema's `enum` has something to be
 * compared against. A bare union type could gain a member with nothing to
 * notice, and the failure is silent at the far end — a `Record<BlockTrust, …>`
 * lookup returning `undefined` rather than throwing.
 */
export const BLOCK_TRUST = ["template", "ai_generated", "lawyer_edited"] as const;

export type BlockTrust = (typeof BLOCK_TRUST)[number];

export interface TraceBlock {
  /** Stable across regenerations, so a re-run updates the trace rather than scrambling it. */
  id: string;
  title: string;
  trust: BlockTrust;
  needs_attention: boolean;
  /** The norms this block implements. */
  law_refs: string[];
  /** Field keys of the answers that fed this block. Keys only, never values (spec §5.5, §6.4). */
  questionnaire_fields: string[];
}

export interface GenerationTrace {
  trace_version: 1;
  service_id: string;
  blocks: TraceBlock[];
}

// The bridges. `satisfies` proves every listed key is a real one; the
// `…KeysAreExhaustive` types prove none is missing. Together they pin the key
// set from the TypeScript side, and the schema test pins it from the other.

export const TRACE_BLOCK_KEYS = [
  "id",
  "title",
  "trust",
  "needs_attention",
  "law_refs",
  "questionnaire_fields",
] as const satisfies readonly (keyof TraceBlock)[];

export const GENERATION_TRACE_KEYS = [
  "trace_version",
  "service_id",
  "blocks",
] as const satisfies readonly (keyof GenerationTrace)[];

/** `never` — and so unsatisfiable — if a key of `TraceBlock` is missing above. */
export type TraceBlockKeysAreExhaustive =
  Exclude<keyof TraceBlock, (typeof TRACE_BLOCK_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `GenerationTrace` is missing above. */
export type GenerationTraceKeysAreExhaustive =
  Exclude<keyof GenerationTrace, (typeof GENERATION_TRACE_KEYS)[number]> extends never
    ? true
    : never;
