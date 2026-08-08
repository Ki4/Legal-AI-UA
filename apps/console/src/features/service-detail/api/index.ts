// The swap point for this feature — see features/services/api/index.ts.

import type { ServiceDetailApi } from "./contract";
import { mockServiceDetailApi } from "./service-detail.mock";

export const serviceDetailApi: ServiceDetailApi = mockServiceDetailApi;

export type { ServiceDetailApi } from "./contract";
export type { ServiceDetail } from "./types";
