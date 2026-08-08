// Stand-in rows, shaped exactly as the tables will be. A feature's api/ layer
// joins them into the view model its screen needs, which is the same work the
// Supabase implementation will do — so swapping the source later changes no
// component (ADR-0012).
//
// Invented data only: never a real client name, email or case detail.

import type { GenerationTrace, ProfileRow, ServiceRow, ServiceVersionRow } from "./types";

export const mockProfiles: ProfileRow[] = [
  { id: "usr-olena", fullName: "Olena Kovalchuk", role: "lawyer" },
  { id: "usr-taras", fullName: "Taras Bondarenko", role: "lawyer" },
  { id: "usr-admin", fullName: "Iryna Shevchenko", role: "admin" },
];

export const mockServices: ServiceRow[] = [
  {
    id: "svc-divorce",
    slug: "divorce-application",
    title: "Divorce application",
    summary: "Application to dissolve a marriage, filed with a district court.",
    assignedLawyerId: "usr-olena",
    createdAt: "2026-05-12T09:20:00.000Z",
    updatedAt: "2026-07-30T14:05:00.000Z",
  },
  {
    id: "svc-alimony",
    slug: "alimony-claim",
    title: "Alimony claim",
    summary: "Claim for child maintenance.",
    assignedLawyerId: "usr-taras",
    createdAt: "2026-06-02T11:00:00.000Z",
    updatedAt: "2026-07-28T08:41:00.000Z",
  },
  {
    id: "svc-poa",
    slug: "power-of-attorney",
    title: "Power of attorney",
    summary: "General power of attorney, no legal consequences for the grantor.",
    assignedLawyerId: null,
    createdAt: "2026-06-19T16:30:00.000Z",
    updatedAt: "2026-07-04T10:15:00.000Z",
  },
];

// Deliberately uneven: svc-divorce has an archived predecessor so the live
// version is not simply "the only one", svc-poa is paused, and svc-alimony has
// never been published — the three states the list has to render differently.
export const mockServiceVersions: ServiceVersionRow[] = [
  {
    id: "sv-divorce-1",
    serviceId: "svc-divorce",
    version: 1,
    status: "archived",
    generationMode: "full_generation",
    reviewMode: "lawyer_required",
    priceMinor: 480000,
    currency: "UAH",
    publishedAt: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "sv-divorce-2",
    serviceId: "svc-divorce",
    version: 2,
    status: "published",
    generationMode: "full_generation",
    reviewMode: "lawyer_required",
    priceMinor: 520000,
    currency: "UAH",
    publishedAt: "2026-07-30T14:05:00.000Z",
  },
  {
    id: "sv-alimony-1",
    serviceId: "svc-alimony",
    version: 1,
    status: "draft",
    generationMode: "block_assembly",
    reviewMode: "lawyer_required",
    priceMinor: 390000,
    currency: "UAH",
    publishedAt: null,
  },
  {
    id: "sv-poa-1",
    serviceId: "svc-poa",
    version: 1,
    status: "paused",
    generationMode: "template",
    reviewMode: "auto",
    priceMinor: 120000,
    currency: "UAH",
    publishedAt: "2026-06-25T12:00:00.000Z",
  },
];

export const mockTrace: GenerationTrace = {
  traceVersion: 1,
  serviceId: "svc-divorce",
  blocks: [
    {
      id: "blk-header",
      title: "Court header and parties",
      trust: "template",
      needsAttention: false,
      lawRefs: [],
      questionnaireFields: ["applicant_name", "respondent_name", "court_region"],
    },
    {
      id: "blk-circumstances",
      title: "Circumstances of the marriage",
      trust: "ai_generated",
      needsAttention: true,
      lawRefs: [],
      questionnaireFields: ["marriage_date", "children", "separation_reason"],
    },
    {
      id: "blk-legal-grounds",
      title: "Legal grounds",
      trust: "ai_generated",
      needsAttention: false,
      lawRefs: ["Family Code of Ukraine, art. 112"],
      questionnaireFields: [],
    },
    {
      id: "blk-request",
      title: "Request to the court",
      trust: "lawyer_edited",
      needsAttention: false,
      lawRefs: [],
      questionnaireFields: ["applicant_name"],
    },
  ],
};
