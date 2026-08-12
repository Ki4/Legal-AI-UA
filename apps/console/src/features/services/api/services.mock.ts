// Fixture implementation of ServicesApi.
//
// It does the same work the Supabase implementation will do — read rows, join
// them, produce the view model — which is the whole reason swapping the two
// later touches no component. A mock shaped for convenience rather than
// accuracy would quietly break that (ADR-0012).

import type { ServiceRow, ServiceVersionRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import {
  assignmentsOf,
  currentVersionRowOf,
  fixtureDelay,
  priceRowOf,
  profileById,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServicesApi } from "./contract";
import type { LawyerRef, ServiceFilter, ServiceListItem, ServiceVersionSummary } from "./types";

function toLawyerRef(lawyerId: string): LawyerRef {
  // An id that resolves to no profile still means someone is assigned. Keeping
  // the ref with a null name says "assigned, name unavailable"; dropping it
  // would say "nobody assigned", which is a different and false statement.
  return { id: lawyerId, fullName: profileById(lawyerId)?.full_name ?? null };
}

function toVersionSummary(version: ServiceVersionRow): ServiceVersionSummary {
  // Price lives in its own per-currency table now (spec §8.6), so this is a
  // join rather than a field copy — and it may legitimately find nothing.
  const price = priceRowOf(version.id);

  return {
    version: version.version,
    status: version.status,
    generationMode: version.generation_mode,
    reviewMode: version.review_mode,
    priceMinor: price?.amount_minor ?? null,
    currency: price?.currency ?? null,
  };
}

function currentVersionOf(serviceId: string): ServiceVersionSummary | null {
  const row = currentVersionRowOf(serviceId);
  return row === null ? null : toVersionSummary(row);
}

function toListItem(service: ServiceRow): ServiceListItem {
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    primaryLawyer:
      assignmentsOf(service.id)
        .filter((a) => a.is_primary)
        .map((a) => toLawyerRef(a.lawyer_id))[0] ?? null,
    coverLawyers: assignmentsOf(service.id)
      .filter((a) => !a.is_primary)
      .map((a) => toLawyerRef(a.lawyer_id)),
    currentVersion: currentVersionOf(service.id),
    createdAt: service.created_at,
    updatedAt: service.updated_at,
  };
}

function matches(item: ServiceListItem, filter: ServiceFilter): boolean {
  if (filter.status && filter.status.length > 0) {
    const status = item.currentVersion?.status;
    if (status === undefined || !filter.status.includes(status)) return false;
  }

  if (filter.lawyerId !== undefined) {
    const attached = [item.primaryLawyer, ...item.coverLawyers].some(
      (ref) => ref?.id === filter.lawyerId,
    );
    if (!attached) return false;
  }

  if (filter.query !== undefined && filter.query.trim() !== "") {
    const needle = filter.query.trim().toLowerCase();
    const haystack = `${item.title} ${item.slug}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export const mockServicesApi: ServicesApi = {
  async list(filter) {
    await fixtureDelay();
    return serviceRows
      .map(toListItem)
      .filter((item) => (filter ? matches(item, filter) : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id) {
    await fixtureDelay();
    const service = serviceRows.find((candidate) => candidate.id === id);
    if (!service) {
      throw new AppError("not_found", `No service with id ${id}.`);
    }
    return toListItem(service);
  },
};
