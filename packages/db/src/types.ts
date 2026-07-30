// Temporary hand-written types. The next iteration replaces this file with types
// generated from the Supabase schema (`supabase gen types typescript`).

export type ServiceStatus = "draft" | "in_review" | "published" | "paused" | "archived";

export type GenerationMode = "template" | "block_assembly" | "full_generation";

export type ReviewMode = "auto" | "lawyer_required";

export interface Service {
  id: string;
  slug: string;
  title: string;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  priceEur: number;
}

export type BlockTrust = "template" | "ai_generated" | "lawyer_edited";

export interface TraceBlock {
  id: string;
  title: string;
  trust: BlockTrust;
  needsAttention: boolean;
  lawRefs: string[];
  questionnaireFields: string[];
}

export interface GenerationTrace {
  traceVersion: 1;
  serviceId: string;
  blocks: TraceBlock[];
}
