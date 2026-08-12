// The contract. This file is what two people agree on before either writes
// anything: one implements it, the other calls it, and the compiler holds both
// to the deal (ADR-0012).
//
// Every implementation — fixtures today, Supabase later — is typed as
// `ServicesApi`, so a drifting implementation fails to compile rather than
// failing in the browser.

import type { CatalogueFilter, CatalogueView, ServiceListItem } from "./types";

export interface ServicesApi {
  /**
   * The catalogue, and the shape of the set it was drawn from.
   *
   * Named `browse` rather than `list` because it answers more than "which
   * rows": the facets it returns are what the filter bar renders, and a screen
   * that had to count them itself would be counting a page rather than a
   * catalogue.
   *
   * An empty result is not an error. `matchedBeforeFacets` is how the caller
   * tells "there is nothing here" from "your filters excluded everything",
   * which are two different screens (§4.1).
   */
  browse(filter?: CatalogueFilter): Promise<CatalogueView>;

  /** Throws AppError("not_found") when there is no such service. */
  get(id: string): Promise<ServiceListItem>;
}

// `setPrimaryLawyer` used to live here as the mutation exemplar. It moved to
// `features/service-detail` with ADM-10, where the screen that calls it is,
// rather than being copied: one mutation with two homes is the "one thing said
// twice" that produced both defects found on 2026-08-11.
