import { AppError } from "../../../shared/api/errors";
import {
  currentVersionRowOf,
  fixtureDelay,
  profileById,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServiceDetailApi } from "./contract";
import type { ServiceDetail } from "./types";

export const mockServiceDetailApi: ServiceDetailApi = {
  async get(id) {
    await fixtureDelay();

    // Reads the shared fixture store, not a private copy: a write made through
    // another feature has to be visible here, the way it would be with one
    // database behind both screens.
    const service = serviceRows.find((candidate) => candidate.id === id);
    if (!service) {
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    const version = currentVersionRowOf(service.id);

    const detail: ServiceDetail = {
      id: service.id,
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      assignedLawyerId: service.assignedLawyerId,
      assignedLawyerName:
        service.assignedLawyerId === null
          ? null
          : (profileById(service.assignedLawyerId)?.fullName ?? null),
      currentVersion:
        version === null
          ? null
          : {
              version: version.version,
              status: version.status,
              generationMode: version.generationMode,
              reviewMode: version.reviewMode,
              priceMinor: version.priceMinor,
              currency: version.currency,
              publishedAt: version.publishedAt,
            },
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };

    return detail;
  },
};
