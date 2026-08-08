// View models for the services screens (ADR-0012, convention 1 and 6).
//
// These are not table rows. `ServiceListItem` carries the assigned lawyer's
// name and the current version's price — data that lives in three tables — so
// that the component renders instead of assembling. They live here rather than
// in packages/db because only this feature's screens need this shape.

import type { GenerationMode, ReviewMode, ServiceStatus } from "@legal-ai/db";

export interface LawyerRef {
  id: string;
  fullName: string;
}

export interface ServiceVersionSummary {
  version: number;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  /** Integer minor units; render with `formatMoney` from shared/format. */
  priceMinor: number;
  currency: string;
}

export interface ServiceListItem {
  id: string;
  slug: string;
  title: string;
  assignedLawyer: LawyerRef | null;
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

export interface ServiceFilter {
  status?: ServiceStatus[];
  lawyerId?: string;
  /** Case-insensitive, matched against title and slug. */
  query?: string;
}
