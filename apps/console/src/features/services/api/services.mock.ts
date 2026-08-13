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
  practiceAreaByCode,
  priceRowOf,
  profileById,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServicesApi } from "./contract";
import { facetAndFilter } from "./facets";
import type {
  CatalogueFilter,
  LawyerRef,
  PracticeAreaRef,
  ServiceListItem,
  ServiceVersionSummary,
} from "./types";

/**
 * Mirrors the Supabase mapping, unresolved code included: the real embed can
 * come back null, so the fixture has to be able to produce that shape too. A
 * fixture that can only succeed builds screens that have never seen bad data.
 */
function toPracticeAreaRef(code: string): PracticeAreaRef {
  const row = practiceAreaByCode(code);
  if (row === null) {
    return { code, labels: { uk: code, en: code }, position: Number.MAX_SAFE_INTEGER };
  }
  return {
    code: row.code,
    labels: { uk: row.label_uk, en: row.label_en },
    position: row.position,
  };
}

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
    summary: service.summary,
    practiceArea: toPracticeAreaRef(service.practice_area),
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

// Only the two filters the database applies. Area and status are counted and
// applied by `facetAndFilter`, which both implementations share — a fixture with
// its own copy of that logic would be a second answer to the same question.
function matches(item: ServiceListItem, filter: CatalogueFilter): boolean {
  if (filter.lawyerId !== undefined) {
    const attached = [item.primaryLawyer, ...item.coverLawyers].some(
      (ref) => ref?.id === filter.lawyerId,
    );
    if (!attached) return false;
  }

  if (filter.query !== undefined && filter.query.trim() !== "") {
    const needle = filter.query.trim().toLowerCase();
    const haystack = `${item.title} ${item.slug} ${item.summary ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export const mockServicesApi: ServicesApi = {
  async browse(filter) {
    await fixtureDelay();
    const matched = serviceRows
      .map(toListItem)
      .filter((item) => (filter ? matches(item, filter) : true));

    return facetAndFilter(matched, filter);
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
