// The swap point. One line picks the implementation (ADR-0012).
//
// Live from the first commit, for the reason `service-fields` gives: every
// act on this screen is a write — a signature, a sale, a pause — and a
// fixture would accept all of them from anybody. `service-versions.mock.ts`
// stays for the contract tests and the route walk.

import type { ServiceVersionsApi } from "./contract";
import { supabaseServiceVersionsApi } from "./service-versions.supabase";

export const serviceVersionsApi: ServiceVersionsApi = supabaseServiceVersionsApi;

export type { ServiceVersionsApi } from "./contract";
export { availableActions, type VersionAction, type Viewer } from "./rights";
export type {
  Assignment,
  LiftResolution,
  PauseInput,
  PauseItem,
  PauseOutcome,
  PauseReason,
  PauseResolution,
  PracticeAreaRef,
  Release,
  Sale,
  ServiceStatus,
  ServiceVersionsPage,
  Signatory,
  StaffRef,
  VersionItem,
} from "./types";
