import { mockProfiles, mockServices, mockServiceVersions } from "@legal-ai/db";
import type { ServiceVersionRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import type { ServiceDetailApi } from "./contract";
import type { ServiceDetail } from "./types";

const LATENCY_MS = 140;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Live version when there is one, otherwise the newest. See the services feature. */
function currentVersionOf(serviceId: string): ServiceVersionRow | null {
  const own = mockServiceVersions.filter((version) => version.serviceId === serviceId);
  const live = own.find((version) => version.status === "published" || version.status === "paused");
  if (live) return live;

  return own.reduce<ServiceVersionRow | null>(
    (best, version) => (best === null || version.version > best.version ? version : best),
    null,
  );
}

export const mockServiceDetailApi: ServiceDetailApi = {
  async get(id) {
    await delay(LATENCY_MS);

    const service = mockServices.find((candidate) => candidate.id === id);
    if (!service) {
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    const lawyer =
      service.assignedLawyerId === null
        ? null
        : (mockProfiles.find((profile) => profile.id === service.assignedLawyerId) ?? null);

    const version = currentVersionOf(service.id);

    const detail: ServiceDetail = {
      id: service.id,
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      assignedLawyerName: lawyer?.fullName ?? null,
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
