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

  /**
   * Moves accountability for a service. Admin-only, and atomic: it runs through
   * the `set_primary_lawyer` RPC rather than two writes from the browser, since
   * clearing the old primary and setting the new one halfway leaves a service
   * with nobody accountable.
   *
   * The previous holder stays attached as cover rather than being detached —
   * losing accountability is not the same as losing access.
   *
   * Returns the updated service so the caller refreshes without a second round
   * trip (ADR-0012, convention 5). Pass null to leave nobody accountable.
   *
   * Not yet wired to a screen — it is the mutation exemplar other features
   * copy, and it is ADM-10 in docs/specs/admin-console.md.
   */
  setPrimaryLawyer(id: string, lawyerId: string | null): Promise<ServiceListItem>;
}
