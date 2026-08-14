// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `ServiceHistoryApi` so a drifting implementation fails to
// compile rather than failing in a browser (ADR-0012).

import type { ServiceHistoryPage } from "./types";

export interface ServiceHistoryApi {
  /**
   * The newest `limit` events for a service, plus whether there are more.
   *
   * Throws AppError("not_found") when there is no such service — which is what
   * makes a mistyped id distinguishable from a service whose history is empty
   * (DoD §4). An empty history is an ordinary answer, not an error: four domain
   * tables shipped before the log did, so a service older than ADR-0010's table
   * genuinely has none.
   */
  get(serviceId: string, limit: number): Promise<ServiceHistoryPage>;

  /**
   * Whether the caller is attached to this service, as the accountable lawyer
   * or as cover.
   *
   * This exists because RLS makes two different answers look identical. Any
   * member of staff may read any service (`services_select_staff`), but only an
   * admin or an attached lawyer may read its events
   * (`audit_events_select_assigned_lawyer`). So a lawyer opening a colleague's
   * service gets an empty array — the same empty array a service with no
   * history gives — and a screen that cannot tell them apart tells a lawyer
   * that a service which has been worked on for months has never been touched.
   *
   * Only meaningful for a lawyer. An admin reads everything without being
   * attached to anything, so the screen does not ask.
   */
  isAttached(serviceId: string): Promise<boolean>;
}
