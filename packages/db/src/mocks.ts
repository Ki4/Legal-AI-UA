// Stand-in rows, shaped exactly as the tables are — snake_case included, since
// these stand in for what Postgres returns. A feature's api/ layer joins them
// into the view model its screen needs, which is the same work the Supabase
// implementation will do, so swapping the source later changes no component
// (ADR-0012).
//
// Invented data only: never a real client name, email or case detail.

import type {
  GenerationTrace,
  ProfileRow,
  ServiceRow,
  ServiceVersionPriceRow,
  ServiceVersionRow,
} from "./types";

export const mockProfiles: ProfileRow[] = [
  {
    id: "usr-olena",
    email: "olena@example.test",
    full_name: "Olena Kovalchuk",
    role: "lawyer",
    created_at: "2026-04-01T09:00:00.000Z",
  },
  {
    id: "usr-taras",
    email: "taras@example.test",
    full_name: "Taras Bondarenko",
    role: "lawyer",
    created_at: "2026-04-02T09:00:00.000Z",
  },
  {
    id: "usr-admin",
    email: "iryna@example.test",
    full_name: "Iryna Shevchenko",
    role: "admin",
    created_at: "2026-03-20T09:00:00.000Z",
  },
];

export const mockServices: ServiceRow[] = [
  {
    id: "svc-divorce",
    slug: "divorce-application",
    title: "Divorce application",
    summary: "Application to dissolve a marriage, filed with a district court.",
    assigned_lawyer_id: "usr-olena",
    created_at: "2026-05-12T09:20:00.000Z",
    updated_at: "2026-07-30T14:05:00.000Z",
  },
  {
    id: "svc-alimony",
    slug: "alimony-claim",
    title: "Alimony claim",
    summary: "Claim for child maintenance.",
    assigned_lawyer_id: "usr-taras",
    created_at: "2026-06-02T11:00:00.000Z",
    updated_at: "2026-07-28T08:41:00.000Z",
  },
  {
    id: "svc-poa",
    slug: "power-of-attorney",
    title: "Power of attorney",
    summary: "General power of attorney, no legal consequences for the grantor.",
    assigned_lawyer_id: null,
    created_at: "2026-06-19T16:30:00.000Z",
    updated_at: "2026-07-04T10:15:00.000Z",
  },
];

// Deliberately uneven: svc-divorce has an archived predecessor so the live
// version is not simply "the only one", svc-poa is paused, and svc-alimony has
// never been published — the three states the list has to render differently.
//
// Mode pairings respect the ADR-0005 constraint the schema now enforces:
// anything but `template` is always `lawyer_required`. A fixture that violated
// it would be a fixture the database would reject.
export const mockServiceVersions: ServiceVersionRow[] = [
  {
    id: "sv-divorce-1",
    service_id: "svc-divorce",
    version: 1,
    status: "archived",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: "2026-05-20T09:00:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-05-12T09:20:00.000Z",
  },
  {
    id: "sv-divorce-2",
    service_id: "svc-divorce",
    version: 2,
    status: "published",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: "2026-07-30T14:05:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-07-20T10:00:00.000Z",
  },
  {
    id: "sv-alimony-1",
    service_id: "svc-alimony",
    version: 1,
    status: "draft",
    generation_mode: "block_assembly",
    review_mode: "lawyer_required",
    published_at: null,
    published_by: null,
    created_at: "2026-06-02T11:00:00.000Z",
  },
  {
    id: "sv-poa-1",
    service_id: "svc-poa",
    version: 1,
    status: "paused",
    generation_mode: "template",
    review_mode: "auto",
    published_at: "2026-06-25T12:00:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-06-19T16:30:00.000Z",
  },
];

// sv-alimony-1 deliberately has no price: a draft that nobody has priced yet is
// an ordinary state, and the screens have to render it rather than assume every
// version costs something.
export const mockServiceVersionPrices: ServiceVersionPriceRow[] = [
  { service_version_id: "sv-divorce-1", currency: "UAH", amount_minor: 480000 },
  { service_version_id: "sv-divorce-2", currency: "UAH", amount_minor: 520000 },
  { service_version_id: "sv-poa-1", currency: "UAH", amount_minor: 120000 },
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
