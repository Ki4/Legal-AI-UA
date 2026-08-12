// The swap point, now swapped — see features/services/api/index.ts.
//
// Second measurement of the ADR-0012 claim, and the one that had a visible
// symptom: while the list read Postgres and the card read fixtures, clicking a
// row navigated to a real uuid the fixtures had never heard of, and the card
// answered "Service not found." Two screens on two sources of truth do not
// merely disagree about content — they disagree about which records exist.
//
// `service-detail.mock.ts` stays. It is the fixture implementation the shared
// store binds together, and what the mock tests run against.

import type { ServiceDetailApi } from "./contract";
import { supabaseServiceDetailApi } from "./service-detail.supabase";

export const serviceDetailApi: ServiceDetailApi = supabaseServiceDetailApi;

export type { ServiceDetailApi } from "./contract";
export type { ServiceDetail } from "./types";
