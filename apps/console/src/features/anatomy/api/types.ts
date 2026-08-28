// View model for the anatomy screen (ADR-0012, convention 1 and 6).
//
// The trace does not come from Postgres. It crosses the core gateway
// (ADR-0004) from a Python service, so its shape is `packages/core-client`'s —
// snake_case, because that is what is on the wire (ADR-0021 §6) — and this
// layer is where it stops being that. Every other feature maps a snake_case
// row to a camelCase view model here; anatomy does the same work for the same
// reason.
//
// `BlockTrust` is domain vocabulary, not a view model — the same status as
// `GenerationMode`/`ReviewMode`/`ServiceStatus` in `features/services/api`
// (convention 6) — so it is re-exported rather than redeclared. From
// `@legal-ai/core-client` and not `@legal-ai/db`: convention 6 says vocabulary
// belongs to the package that owns the value, and the core owns this one.
// Re-exported at all so that a component keeps importing `../api` and never
// learns which package the word came from — the point of the convention is
// that moving it again is this file's diff and nobody else's.
//
// **One contract field has no view model here, and the absence is a decision.**
// A view model exists because a screen renders it (convention 6), so a field
// nothing renders would be a field this layer has to keep truthful for no one:
//
//   `trace_version`  tells a reader of an archived trace which shape to expect.
//                    A screen rendering the trace it just fetched knows already.
//
// `selected_by` and `tool_calls` were on that list until 2026-08-28, deferred to
// a review screen that does not exist. The deferral was wrong about which screen
// they belong to: the condition is the whole of *why a block is in this
// document*, and this is the screen whose subject is that question. They are
// rendered here, and the review screen will render them again with a reviewer's
// controls around them — the same trace, two consumers, which is what
// `VISION.md` said before either screen was built.

import type { BlockTrust, ToolOutcome } from "@legal-ai/core-client";

export type { BlockTrust, ToolOutcome } from "@legal-ai/core-client";

/**
 * A cited norm, already resolved out of the trace's register.
 *
 * The wire carries the norms once at the top and has each block point in by id
 * (ADR-0021 — four blocks citing one article must not be able to describe it
 * four different ways). Resolving that is join work, and joins happen once in
 * this layer (DoD §3), so a component never holds an id it has to look up.
 *
 * `actTitle` and `article` stay apart rather than being joined into one label
 * here. `features/law` renders a norm as `{actTitle} {article}` in
 * `CadenceEditor` and `NormsTable`; formatting it differently in this layer
 * would give the same norm two appearances in one console.
 */
export interface LawRefView {
  normId: string;
  actTitle: string;
  /** Null when the whole act is what is relied on, never merely unknown. */
  article: string | null;
}

/**
 * Why this block is in the document, when it did not have to be.
 *
 * `fieldKeys` stays separate rather than being parsed back out of
 * `expression`: parsing it out means an expression parser in the console, which
 * is a second implementation of the template language living in the wrong zone.
 * The core says both, and this layer carries both.
 */
export interface BlockConditionView {
  expression: string;
  /** Keys of the answers the condition read. Keys only — never their values. */
  fieldKeys: string[];
}

/**
 * One call the core made while producing a block.
 *
 * `started_at` has no field here, and that is the one deliberate omission on
 * this type. The calls arrive in the order they started and are rendered in it,
 * so the sequence — which is what a reader of a failed-then-retried call needs —
 * is already on screen. A timestamp would add a second answer to the same
 * question, rendered at a resolution that makes calls seconds apart look
 * simultaneous. It is in the contract, and the screen that needs the clock
 * rather than the order is where it becomes a view model.
 */
export interface ToolCallView {
  tool: string;
  outcome: ToolOutcome;
}

export interface TraceBlockView {
  id: string;
  title: string;
  trust: BlockTrust;
  needsAttention: boolean;
  /** Null when the block is unconditional, never merely unknown. */
  selectedBy: BlockConditionView | null;
  lawRefs: LawRefView[];
  questionnaireFields: string[];
  toolCalls: ToolCallView[];
}

export interface GenerationTraceView {
  serviceId: string;
  blocks: TraceBlockView[];
}
