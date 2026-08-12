// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `ServiceDetailApi` so a drifting implementation fails to
// compile rather than failing in a browser (ADR-0012).
//
// The three mutations below are ADM-10. They live here rather than in
// `features/services` — where `setPrimaryLawyer` was first written as an
// exemplar — because the editor they serve is a section of the card, and a
// feature may not import from a sibling. The operation moved rather than being
// copied: one mutation with two homes is the "one thing said twice" that this
// repo has already had to repair twice.

import type { AssignableLawyer, ServiceDetail } from "./types";

export interface ServiceDetailApi {
  /** Throws AppError("not_found") when there is no such service. */
  get(id: string): Promise<ServiceDetail>;

  /**
   * Staff who may be attached to a service, by name. Lawyers only: an admin
   * decides what is on sale, the assigned lawyer answers for the content
   * (ADR-0005, spec §4.3), so accountability cannot rest with an admin.
   *
   * An empty result is not an error — a firm with no approved lawyers yet is
   * an ordinary early state.
   */
  listAssignableLawyers(): Promise<AssignableLawyer[]>;

  /**
   * Moves accountability for a service. Admin-only, and atomic: it runs through
   * the `set_primary_lawyer` RPC rather than two writes from the browser, since
   * clearing the old holder and setting the new one halfway leaves a service
   * with nobody accountable.
   *
   * The previous holder stays attached as cover rather than being detached —
   * losing accountability is not the same as losing access.
   *
   * Pass null to leave nobody accountable.
   */
  setPrimaryLawyer(id: string, lawyerId: string | null): Promise<ServiceDetail>;

  /**
   * Attaches a lawyer as cover. Permitted to an admin, and to the accountable
   * lawyer on their own service — which is the case the table exists for: a
   * Friday absence must not breach Monday's deadline with nobody at fault
   * (spec §13, Q18).
   *
   * Throws AppError("conflict") when that lawyer is already attached, in
   * either role.
   */
  addCover(id: string, lawyerId: string): Promise<ServiceDetail>;

  /**
   * Detaches a cover lawyer. The accountable lawyer is not removable this way:
   * accountability is moved with `setPrimaryLawyer`, never dropped, so that a
   * service cannot be left with nobody answering for it.
   */
  removeCover(id: string, lawyerId: string): Promise<ServiceDetail>;
}
