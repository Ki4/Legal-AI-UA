// Domain vocabulary shared by both apps, plus row shapes standing in for the
// tables until the schema exists.
//
// The next iteration replaces the row types here with output from
// `supabase gen types typescript`. That is why nothing screen-specific belongs
// in this file — a view model lives in its feature's own api/types.ts
// (ADR-0012, convention 6), or regeneration would flatten it.

export type ServiceStatus = "draft" | "in_review" | "published" | "paused" | "archived";

export type GenerationMode = "template" | "block_assembly" | "full_generation";

export type ReviewMode = "auto" | "lawyer_required";

export type Role = "admin" | "lawyer";

/**
 * A catalogue entry. Everything that varies over time — price, modes, status —
 * lives on the version, not here, so that a published version can be frozen
 * while the service itself keeps a stable identity (ADR-0009).
 */
export interface ServiceRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  assignedLawyerId: string | null;
  /** ISO 8601 — never a Date object (ADR-0012, convention 2). */
  createdAt: string;
  updatedAt: string;
}

export interface ServiceVersionRow {
  id: string;
  serviceId: string;
  version: number;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  /** Integer minor units. 120000 + "UAH" is ₴1,200.00. */
  priceMinor: number;
  currency: string;
  publishedAt: string | null;
}

export interface ProfileRow {
  id: string;
  /**
   * Nullable, because `profiles.full_name` is: it is filled from the
   * registration form's metadata and a row can exist without one. A view model
   * that claims otherwise would compile and then meet its first nameless
   * lawyer in production.
   */
  fullName: string | null;
  role: Role | null;
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
