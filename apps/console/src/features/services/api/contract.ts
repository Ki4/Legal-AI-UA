// The contract. This file is what two people agree on before either writes
// anything: one implements it, the other calls it, and the compiler holds both
// to the deal (ADR-0012).
//
// Every implementation — fixtures today, Supabase later — is typed as
// `ServicesApi`, so a drifting implementation fails to compile rather than
// failing in the browser.

import type { ServiceFilter, ServiceListItem } from "./types";

export interface ServicesApi {
  /** Catalogue, newest first. An empty result is not an error. */
  list(filter?: ServiceFilter): Promise<ServiceListItem[]>;

  /** Throws AppError("not_found") when there is no such service. */
  get(id: string): Promise<ServiceListItem>;
}

// `setPrimaryLawyer` used to live here as the mutation exemplar. It moved to
// `features/service-detail` with ADM-10, where the screen that calls it is,
// rather than being copied: one mutation with two homes is the "one thing said
// twice" that produced both defects found on 2026-08-11.
