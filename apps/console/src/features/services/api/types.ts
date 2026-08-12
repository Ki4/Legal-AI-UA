// View models for the services screens (ADR-0012, convention 1 and 6).
//
// These are not table rows. `ServiceListItem` carries the assigned lawyer's
// name and the current version's price — data that lives in three tables — so
// that the component renders instead of assembling. They live here rather than
// in packages/db because only this feature's screens need this shape.

import type { GenerationMode, ReviewMode, ServiceStatus } from "@legal-ai/db";

export interface LawyerRef {
  id: string;
  /**
   * Null when a lawyer is assigned but their profile could not be read —
   * deleted, or hidden by RLS from the current user. Distinct from
   * `assignedLawyer: null`, which means nobody is assigned: reporting "no
   * lawyer" for a service that has one is a lie the layer must not tell.
   */
  fullName: string | null;
}

/**
 * The branch of law a service sits in (ADR-0015).
 *
 * `label` is the English one, because console copy is hardcoded English until
 * `packages/i18n` exists (ADR-0006). The row carries both, and the day the
 * dictionaries land this is the one line that changes.
 */
export interface PracticeAreaRef {
  code: string;
  label: string;
  /** Display order, from the reference table. Never the array's own order. */
  position: number;
}

export interface ServiceVersionSummary {
  version: number;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  /**
   * Integer minor units; render with `formatMoney` from shared/format. Null
   * when the version has no price in the display currency — an unpriced draft
   * is an ordinary state, and a zero would be a different claim.
   */
  priceMinor: number | null;
  currency: string | null;
}

export interface ServiceListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /** Required in the schema, so required here (ADR-0015). */
  practiceArea: PracticeAreaRef;
  /**
   * The lawyer accountable for this service. Null only while nobody has been
   * made accountable — a state a service may not be published in.
   */
  primaryLawyer: LawyerRef | null;
  /**
   * Everyone else attached to the service. They can do everything the primary
   * can; what they do not carry is the obligation, which is why they are a
   * separate field rather than a flag in one list.
   */
  coverLawyers: LawyerRef[];
  /**
   * The version the catalogue reflects: the live one — published or paused —
   * when there is one, otherwise the newest. Null only for a service with no
   * versions yet, which the list renders as a dash rather than a zero.
   */
  currentVersion: ServiceVersionSummary | null;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueFilter {
  /** Practice area codes. Absent or empty means every area. */
  areas?: string[];
  status?: ServiceStatus[];
  /** Matches a lawyer in any role on the service — accountable or cover. */
  lawyerId?: string;
  /** Case-insensitive, matched against title, slug and summary. */
  query?: string;
}

/**
 * One filter value and how many services are behind it.
 *
 * The count is what makes a filter honest: a value that leads to an empty
 * screen teaches the reader that the screen is broken when it is merely empty.
 * Values with a count of zero are never returned, so a screen cannot offer one
 * by accident.
 */
export interface AreaFacet {
  area: PracticeAreaRef;
  count: number;
}

export interface StatusFacet {
  status: ServiceStatus;
  count: number;
}

/**
 * What the catalogue screen needs in one answer: the services, and the shape of
 * the set they were drawn from.
 *
 * The facets are counted **before** the area and status filters are applied and
 * after the search and the lawyer filter — which is what lets a chip say how
 * many services it would show, and lets the screen say "nothing in Family, 2
 * matches elsewhere" instead of rendering a blank result and letting a lawyer
 * conclude the firm has no such service.
 *
 * §4.1 records why this is one round trip and where its ceiling is.
 */
export interface CatalogueView {
  /** Matching every active filter. Ordered by area, then title. */
  items: ServiceListItem[];
  /** Ordered by the reference table's position. Never contains a zero. */
  areas: AreaFacet[];
  statuses: StatusFacet[];
  /**
   * How many services matched the search and the lawyer filter, before area and
   * status narrowed them. Zero here means the catalogue itself has nothing to
   * show; zero `items` with a positive number here means the filters did it.
   */
  matchedBeforeFacets: number;
}
