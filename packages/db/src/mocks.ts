import type { GenerationTrace, Service } from "./types";

export const mockServices: Service[] = [
  {
    id: "svc-divorce",
    slug: "divorce-application",
    title: "Divorce application",
    status: "published",
    generationMode: "full_generation",
    reviewMode: "lawyer_required",
    priceEur: 120,
  },
  {
    id: "svc-alimony",
    slug: "alimony-claim",
    title: "Alimony claim",
    status: "published",
    generationMode: "block_assembly",
    reviewMode: "lawyer_required",
    priceEur: 90,
  },
  {
    id: "svc-poa",
    slug: "power-of-attorney",
    title: "Power of attorney",
    status: "paused",
    generationMode: "template",
    reviewMode: "auto",
    priceEur: 30,
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
