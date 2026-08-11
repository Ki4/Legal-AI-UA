// The swap point, now swapped (ADM-7).
//
// This one line is the entire diff the rest of the feature saw when the
// catalogue moved from fixtures to Postgres: no component, no hook, no view
// model changed. That was the claim ADR-0012 made, and this is the first time
// it has been tested.
//
// `services.mock.ts` stays. It is what the tests run against — they assert the
// joining and filtering rules without needing a database — and it remains the
// shape any new implementation is checked against.

import type { ServicesApi } from "./contract";
import { supabaseServicesApi } from "./services.supabase";

export const servicesApi: ServicesApi = supabaseServicesApi;

export type { ServicesApi } from "./contract";
export type { LawyerRef, ServiceFilter, ServiceListItem, ServiceVersionSummary } from "./types";
