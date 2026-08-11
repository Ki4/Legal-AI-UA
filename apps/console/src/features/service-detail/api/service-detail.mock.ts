import { AppError } from "../../../shared/api/errors";
import {
  assignmentsOf,
  currentVersionRowOf,
  fixtureDelay,
  priceRowOf,
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
    // The accountable lawyer. Cover is not surfaced on this screen yet — the
    // overview shows who answers for the service, and the assignment editor is
    // ADM-10.
    const primary = assignmentsOf(service.id).find((a) => a.is_primary);

    const detail: ServiceDetail = {
      id: service.id,
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      assignedLawyerId: primary?.lawyer_id ?? null,
      assignedLawyerName:
        primary === undefined ? null : (profileById(primary.lawyer_id)?.full_name ?? null),
      currentVersion:
        version === null
          ? null
          : {
              version: version.version,
              status: version.status,
              generationMode: version.generation_mode,
              reviewMode: version.review_mode,
              priceMinor: priceRowOf(version.id)?.amount_minor ?? null,
              currency: priceRowOf(version.id)?.currency ?? null,
              publishedAt: version.published_at,
            },
      createdAt: service.created_at,
      updatedAt: service.updated_at,
    };

    return detail;
  },
};
