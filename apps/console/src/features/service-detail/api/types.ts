// This feature's own view model. It overlaps ServiceListItem and is
// deliberately not shared with it: the list needs a row, the card needs a
// summary and timestamps, and coupling two screens through one type means
// every change to either drags the other along (ADR-0012, convention 6).

import type { GenerationMode, ReviewMode, ServiceStatus } from "@legal-ai/db";

export interface ServiceDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  assignedLawyerName: string | null;
  currentVersion: {
    version: number;
    status: ServiceStatus;
    generationMode: GenerationMode;
    reviewMode: ReviewMode;
    priceMinor: number;
    currency: string;
    publishedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
