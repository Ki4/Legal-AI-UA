// The swap point. One line picks the implementation (ADR-0012).
//
// Live from the first commit, unlike the catalogue and the card, which each
// shipped on fixtures and moved later. There was nothing to gain by waiting:
// the table this screen reads has been filled by triggers since 2026-08-11, so
// the fixtures would have been the *less* honest source from day one.
//
// `service-history.mock.ts` stays. It is what the contract tests run against —
// the sorting, the paging and the three actor states are assertable without a
// database — and it remains the shape any new implementation is checked
// against.

import type { ServiceHistoryApi } from "./contract";
import { supabaseServiceHistoryApi } from "./service-history.supabase";

export const serviceHistoryApi: ServiceHistoryApi = supabaseServiceHistoryApi;

export type { ServiceHistoryApi } from "./contract";
export type { HistoryActor, ServiceHistoryEvent, ServiceHistoryPage } from "./types";
