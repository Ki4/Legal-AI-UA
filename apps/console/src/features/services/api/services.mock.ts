// Fixture implementation of ServicesApi.
//
// It does the same work the Supabase implementation will do — read rows, join
// them, produce the view model — which is the whole reason swapping the two
// later touches no component. A mock shaped for convenience rather than
// accuracy would quietly break that (ADR-0012).

import type { ServiceRow, ServiceVersionRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import {
  currentVersionRowOf,
  profileById,
  profileRows,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServicesApi } from "./contract";
import type { LawyerRef, ServiceFilter, ServiceListItem, ServiceVersionSummary } from "./types";

/** Enough delay that loading states get built rather than discovered later. */
const LATENCY_MS = 140;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toLawyerRef(lawyerId: string | null): LawyerRef | null {
  if (lawyerId === null) return null;
  // An id that resolves to no profile still means someone is assigned. Keeping
  // the ref with a null name says "assigned, name unavailable"; returning null
  // would say "nobody assigned", which is a different and false statement.
  return { id: lawyerId, fullName: profileById(lawyerId)?.fullName ?? null };
}

function toVersionSummary(version: ServiceVersionRow): ServiceVersionSummary {
  return {
    version: version.version,
    status: version.status,
    generationMode: version.generationMode,
    reviewMode: version.reviewMode,
    priceMinor: version.priceMinor,
    currency: version.currency,
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
    assignedLawyer: toLawyerRef(service.assignedLawyerId),
    currentVersion: currentVersionOf(service.id),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

function matches(item: ServiceListItem, filter: ServiceFilter): boolean {
  if (filter.status && filter.status.length > 0) {
    const status = item.currentVersion?.status;
    if (status === undefined || !filter.status.includes(status)) return false;
  }

  if (filter.lawyerId !== undefined && item.assignedLawyer?.id !== filter.lawyerId) {
    return false;
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
    await delay(LATENCY_MS);
    return serviceRows
      .map(toListItem)
      .filter((item) => (filter ? matches(item, filter) : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id) {
    await delay(LATENCY_MS);
    const service = serviceRows.find((candidate) => candidate.id === id);
    if (!service) {
      throw new AppError("not_found", `No service with id ${id}.`);
    }
    return toListItem(service);
  },

  async assignLawyer(id, lawyerId) {
    await delay(LATENCY_MS);

    const service = serviceRows.find((candidate) => candidate.id === id);
    if (!service) {
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    if (lawyerId !== null && !profileRows.some((profile) => profile.id === lawyerId)) {
      throw new AppError("validation", `No profile with id ${lawyerId}.`);
    }

    // The Supabase implementation runs its returned rows through `expectOne`
    // from shared/api/errors — a denial by an RLS USING clause writes nothing
    // and reports no error, so the row count is the only signal. There is no
    // RLS here, hence no call: the guard belongs where the risk is.
    service.assignedLawyerId = lawyerId;
    service.updatedAt = new Date().toISOString();

    return toListItem(service);
  },
};
