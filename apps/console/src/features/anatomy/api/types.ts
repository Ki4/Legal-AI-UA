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
// **Three contract fields have no view model here, and each absence is a
// decision.** A view model exists because a screen renders it (convention 6),
// so a field nothing renders would be a field this layer has to keep truthful
// for no one:
//
//   `trace_version`  tells a reader of an archived trace which shape to expect.
//                    A screen rendering the trace it just fetched knows already.
//   `selected_by`    the branching condition. Spec §4.6 promises a lawyer this,
//                    on the runs screen — ADM-28, which does not exist. It is in
//                    the contract because freezing the field list was the point
//                    of that pass, not because this screen is ready for it.
//   `tool_calls`     the same, and it belongs to the review screen rather than
//                    the client-facing anatomy view.
//
// They stay in the contract and arrive here when the screen that renders them
// does. That is the layer working, not the layer lagging.

import type { BlockTrust } from "@legal-ai/core-client";

export type { BlockTrust } from "@legal-ai/core-client";

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

export interface TraceBlockView {
  id: string;
  title: string;
  trust: BlockTrust;
  needsAttention: boolean;
  lawRefs: LawRefView[];
  questionnaireFields: string[];
}

export interface GenerationTraceView {
  serviceId: string;
  blocks: TraceBlockView[];
}
