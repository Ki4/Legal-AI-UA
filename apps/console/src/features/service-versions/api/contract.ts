// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `ServiceVersionsApi` so a drifting implementation fails to
// compile rather than failing in a browser (ADR-0012).
//
// Every mutation returns the whole page rather than one version: a sale
// archives the predecessor, and the fix going on sale closes the predecessor's
// pause (§5.7), so the row the caller touched is never the only row that
// changed.
//
// Rights are not checked here and not in the fixture. Every act below is
// refused by a guard or a policy in the schema and asserted in
// `verify_practice_area_signatories.sql` and `verify_service_pauses.sql`; what
// this layer promises is that a refusal arrives as an `AppError` and never as a
// screen reporting "saved".

import type { LiftResolution, PauseInput, ServiceVersionsPage } from "./types";

export interface ServiceVersionsApi {
  /** Throws AppError("not_found") when there is no such service. */
  listForService(serviceId: string): Promise<ServiceVersionsPage>;

  /**
   * The author's act, both directions: `draft` → `in_review` says "ready,
   * check it", and back again withdraws it. Stepping back also withdraws a
   * signature, by trigger — the signature stood under a text that is being
   * reopened.
   */
  submitForReview(versionId: string): Promise<ServiceVersionsPage>;
  returnToDraft(versionId: string): Promise<ServiceVersionsPage>;

  /**
   * The professional act (ADR-0027): a signatory of the service's practice
   * area signs a version that is `in_review`. Runs through
   * `release_service_version`, the only path that writes `released_*`. The
   * function refuses the author while the area has another signatory, and
   * stamps `self_released` when it has none.
   */
  release(versionId: string): Promise<ServiceVersionsPage>;

  /**
   * The commercial act: an admin puts a released version on sale, and the live
   * predecessor is archived by the same statement. Refused for an unreleased
   * version — as a trigger and as a check constraint.
   */
  putOnSale(versionId: string): Promise<ServiceVersionsPage>;

  /**
   * Opens a pause: a row with a reason (§5.7). Who may open one depends on the
   * reason and is the guard's business; the version's status follows the row.
   */
  pause(versionId: string, input: PauseInput): Promise<ServiceVersionsPage>;

  /**
   * Closes a pause as `resumed` or `archived`. `new_version` is deliberately
   * not accepted: the fix going on sale writes that one, naming itself.
   */
  lift(pauseId: string, resolution: LiftResolution): Promise<ServiceVersionsPage>;
}
