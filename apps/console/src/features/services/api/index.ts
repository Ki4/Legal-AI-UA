// The swap point.
//
// When the schema lands, this file changes from mockServicesApi to
// supabaseServicesApi and nothing else in the feature moves — no component,
// no hook, no type. That is the entire purpose of the layer (ADR-0012).

import type { ServicesApi } from "./contract";
import { mockServicesApi } from "./services.mock";

export const servicesApi: ServicesApi = mockServicesApi;

export type { ServicesApi } from "./contract";
export type { LawyerRef, ServiceFilter, ServiceListItem, ServiceVersionSummary } from "./types";
