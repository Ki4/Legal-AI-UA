import type { ServiceDetail } from "./types";

export interface ServiceDetailApi {
  /** Throws AppError("not_found") when there is no such service. */
  get(id: string): Promise<ServiceDetail>;
}
