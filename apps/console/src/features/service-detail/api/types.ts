// This feature's own view model. It overlaps ServiceListItem and is
// deliberately not shared with it: the list needs a row, the card needs a
// summary and timestamps, and coupling two screens through one type means
// every change to either drags the other along (ADR-0012, convention 6).

import type { GenerationMode, ReviewMode, ServiceStatus } from "@legal-ai/db";

/**
 * A lawyer as the card refers to them.
 *
 * `features/services` declares a type of the same name and the same meaning.
 * The repetition is the arrangement, not an oversight: two features sharing one
 * view model is the coupling ADR-0012 forbids, and what must not diverge is the
 * *rule* below, which is therefore stated in full in both places.
 */
export interface LawyerRef {
  id: string;
  /**
   * Null when the lawyer is attached but their profile could not be read —
   * deleted, or hidden by RLS from the current user. Distinct from the absence
   * of a `LawyerRef` altogether, which means nobody is attached: reporting "no
   * lawyer" for a service that has one is a lie the layer must not tell.
   */
  fullName: string | null;
}

/**
 * A member of staff the card may attach to a service.
 *
 * Email is carried because two colleagues can share a first name and the
 * picker has to be unambiguous — `full_name` is nullable, and a row with no
 * name would otherwise be a blank button.
 */
export interface AssignableLawyer {
  id: string;
  fullName: string | null;
  email: string;
}

export interface ServiceDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /**
   * The lawyer accountable for this service — the addressee of the cabinet's
   * obligations and the §9.16 triage deadline. Null only while nobody has been
   * made accountable, a state a service may not be published in.
   */
  primaryLawyer: LawyerRef | null;
  /**
   * Everyone else attached. Cover carries the same rights as the accountable
   * lawyer and none of the obligation (spec §13), which is why it is a separate
   * field rather than a flag inside one list: a screen that renders them
   * together would be stating that the two roles are the same.
   */
  coverLawyers: LawyerRef[];
  currentVersion: {
    version: number;
    status: ServiceStatus;
    generationMode: GenerationMode;
    reviewMode: ReviewMode;
    priceMinor: number | null;
    currency: string | null;
    publishedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
