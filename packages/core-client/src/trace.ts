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
// the bridges below are exactly an assertion that it is not.
//
// **The field list is frozen against `docs/VISION.md`'s "Document anatomy"**,
// which names six things a block records: a trust status, the questionnaire
// answers that fed it, the law articles it rests on with a verification date,
// the branching condition that selected it, the core tool calls that produced
// it, and a `needs_attention` flag. All six are here. `README.md` has what was
// considered and left out, and why — that reasoning does not go in the schema's
// `description` fields, which are consumer-facing and end up on the wire.

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

/**
 * The publisher a norm was read from.
 *
 * One value today, and the array is not a formality for that reason: this
 * mirrors `public.law_source`, which is also a one-value enum, and a second
 * publisher arriving on one side only is exactly what the bridge is here for.
 */
export const LAW_SOURCE = ["zakon_rada"] as const;

export type LawSource = (typeof LAW_SOURCE)[number];

/** Whether a tool call returned a result or failed. */
export const TOOL_OUTCOME = ["ok", "error"] as const;

export type ToolOutcome = (typeof TOOL_OUTCOME)[number];

/**
 * An ISO 8601 instant in UTC, `Z`-suffixed, never an offset and never a `Date`
 * (ADR-0012 convention 2). TypeScript cannot express the shape — the schema's
 * `Instant` pattern is what enforces it, and this alias exists so a reader of a
 * field type learns that a bare `string` is not what is meant.
 */
export type Instant = string;

/**
 * A norm the document rests on, as it stood when the document was generated.
 *
 * Both a pointer and a snapshot, and it has to be both. The pointer is what a
 * live screen follows into the register to ask "has this changed since?". The
 * snapshot is what survives the register moving on — a trace is archived in the
 * issued document's passport (spec §5.3) and read years later, by which time
 * the norm may have been re-scoped, re-titled, or dropped.
 *
 * There is no `scope` field. `public.law_norms` has one, constrained so that
 * `article is not null` exactly when the scope is an article; carrying both
 * here would be two representations of one fact, which is what that migration's
 * own comments refuse except for a generated column that cannot drift. So
 * `article === null` *is* act scope, and there is nothing to keep consistent.
 */
export interface LawRef {
  /** The watched norm this cites, in the platform's register. */
  norm_id: string;
  source: LawSource;
  /** The act as its publisher names it, normalized: `2947-14`, `z0123-19`. */
  act_id: string;
  /** The act's title, for a person to read. The identifier is not one. */
  act_title: string;
  /** The article within the act, or null when the whole act is what is relied on. */
  article: string | null;
  /**
   * One line on what the service leans on this norm for, written by the lawyer
   * who attached it — `public.service_law_refs.relied_on`. Carried into the
   * trace rather than left to a join, because when a diff arrives in six months
   * this sentence is the whole of what tells a reader whether the change
   * matters, and by then the join may no longer resolve.
   */
  relied_on: string;
  /**
   * When the norm was last checked against its published text and found
   * unchanged, as of generation time. Null when it had never been successfully
   * verified — a different fact from "never checked", which the register keeps
   * apart for the reason spec §9.10 gives.
   */
  verified_at: Instant | null;
}

/**
 * The branching condition that selected a block.
 *
 * `expression` is text rather than a structure on purpose: the condition editor
 * (ADM-16) and the template schema (ADM-1) do not exist, so an AST frozen here
 * would be a guess about decisions nobody has made — the mistake ADR-0021's
 * journal records for law references, which were nearly frozen as a triple that
 * could not express act scope. Text is what the core can honestly produce today
 * and what spec §4.6 promises a lawyer: "which condition fired, so I know what
 * to fix rather than guessing".
 *
 * `field_keys` is carried separately rather than parsed back out of
 * `expression`, because parsing it back out means an expression parser in the
 * console — a second implementation of the template language, living in the
 * wrong zone.
 */
export interface BlockCondition {
  /** The condition as the template states it, rendered for a person to read. */
  expression: string;
  /** Field keys of the answers the condition read. Keys only, never values. */
  field_keys: string[];
}

/**
 * One call the core made while producing a block.
 *
 * **No arguments and no results, and that is a decision rather than an
 * omission.** A tool call's arguments carry client answers, and spec §5.5 and
 * §6.4 say keys only, never values. `docs/CONTRIBUTING.md` settles which
 * reading wins when a rule is arguable — the stricter one, until the question
 * is explicitly resolved — so the schema gives personal data nowhere to sit
 * rather than trusting the core to leave it out. Adding a redacted-arguments
 * field later is a version bump; removing one that leaked is an incident.
 */
export interface ToolCall {
  /** The tool's name, as the core registers it. */
  tool: string;
  started_at: Instant;
  outcome: ToolOutcome;
}

export interface TraceBlock {
  /** Stable across regenerations, so a re-run updates the trace rather than scrambling it. */
  id: string;
  title: string;
  trust: BlockTrust;
  needs_attention: boolean;
  /** The condition that put this block in the document, or null when it is unconditional. */
  selected_by: BlockCondition | null;
  /**
   * The norms this block implements, as `norm_id` values resolving against the
   * trace's `law_refs`. Ids rather than inline objects: four blocks citing one
   * article would otherwise carry four copies of it, and nothing in a schema
   * can stop two of those copies disagreeing. The register mirrors what
   * `public.law_norms` does for the same reason (spec §9.3 — watched once and
   * depended on many times).
   *
   * That a `norm_id` here resolves is **not** expressible in JSON Schema. It is
   * asserted in `schema.test.ts` against the fixtures, and named in `README.md`
   * as one of the things the contract cannot prove about itself.
   */
  law_ref_ids: string[];
  /** Field keys of the answers that fed this block. Keys only, never values (spec §5.5, §6.4). */
  questionnaire_fields: string[];
  /** The core's calls while producing this block, in the order they started. */
  tool_calls: ToolCall[];
}

export interface GenerationTrace {
  trace_version: 1;
  service_id: string;
  /** Every norm any block cites, listed once. Blocks point in by `norm_id`. */
  law_refs: LawRef[];
  blocks: TraceBlock[];
}

// The bridges. `satisfies` proves every listed key is a real one; the
// `…KeysAreExhaustive` types prove none is missing. Together they pin the key
// set from the TypeScript side, and the schema test pins it from the other.

export const LAW_REF_KEYS = [
  "norm_id",
  "source",
  "act_id",
  "act_title",
  "article",
  "relied_on",
  "verified_at",
] as const satisfies readonly (keyof LawRef)[];

export const BLOCK_CONDITION_KEYS = [
  "expression",
  "field_keys",
] as const satisfies readonly (keyof BlockCondition)[];

export const TOOL_CALL_KEYS = [
  "tool",
  "started_at",
  "outcome",
] as const satisfies readonly (keyof ToolCall)[];

export const TRACE_BLOCK_KEYS = [
  "id",
  "title",
  "trust",
  "needs_attention",
  "selected_by",
  "law_ref_ids",
  "questionnaire_fields",
  "tool_calls",
] as const satisfies readonly (keyof TraceBlock)[];

export const GENERATION_TRACE_KEYS = [
  "trace_version",
  "service_id",
  "law_refs",
  "blocks",
] as const satisfies readonly (keyof GenerationTrace)[];

/** `never` — and so unsatisfiable — if a key of `LawRef` is missing above. */
export type LawRefKeysAreExhaustive =
  Exclude<keyof LawRef, (typeof LAW_REF_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `BlockCondition` is missing above. */
export type BlockConditionKeysAreExhaustive =
  Exclude<keyof BlockCondition, (typeof BLOCK_CONDITION_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `ToolCall` is missing above. */
export type ToolCallKeysAreExhaustive =
  Exclude<keyof ToolCall, (typeof TOOL_CALL_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `TraceBlock` is missing above. */
export type TraceBlockKeysAreExhaustive =
  Exclude<keyof TraceBlock, (typeof TRACE_BLOCK_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `GenerationTrace` is missing above. */
export type GenerationTraceKeysAreExhaustive =
  Exclude<keyof GenerationTrace, (typeof GENERATION_TRACE_KEYS)[number]> extends never
    ? true
    : never;
