// The swap point: one line picks the implementation (ADR-0012).
//
// Anatomy has no live source yet — the real trace crosses the core gateway
// (ADR-0004), and `apps/core` does not exist yet (root `CLAUDE.md`) — so this
// still points at the fixture. When it does, swapping here is the entire diff
// this feature's components see, same as `features/services/api/index.ts`.

import type { AnatomyApi } from "./contract";
import { mockAnatomyApi } from "./anatomy.mock";

export const anatomyApi: AnatomyApi = mockAnatomyApi;

export type { AnatomyApi } from "./contract";
export type {
  BlockConditionView,
  BlockTrust,
  GenerationTraceView,
  LawRefView,
  ToolCallView,
  ToolOutcome,
  TraceBlockView,
} from "./types";
