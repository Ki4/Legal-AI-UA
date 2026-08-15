// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `OrdersApi` so a drifting implementation fails to compile
// rather than failing in a browser (ADR-0012).

import type { OrdersPage } from "./types";

export interface OrdersApi {
  /**
   * The newest `limit` orders the caller may read, plus whether there are more.
   *
   * There is no filter argument and no service parameter. Which orders come
   * back is `orders_select_staff` — an admin reads every row, a lawyer reads
   * the orders of services they are attached to and any order handed to them.
   * A filter here would be a second, weaker answer to a question the policy has
   * already answered, and the two would disagree the first time somebody
   * changed one (DoD §7: hiding a control is presentation, the policy is what
   * protects).
   *
   * An empty result is an ordinary answer. Nothing writes orders yet — the
   * gateway does (ADM-5) — so an empty list is the expected state of a working
   * system today, which is exactly why `isStaffWithNoReach` exists.
   */
  list(limit: number): Promise<OrdersPage>;

  /**
   * Whether this caller could see an order if one existed — that is, whether
   * they are attached to any service at all.
   *
   * The same shape of question the service history has to ask, and for the same
   * reason: RLS answers "you may not see these" and "there are none" with the
   * same empty array. A lawyer attached to nothing gets an empty list whether
   * the platform has ten thousand orders or none, and a screen that cannot tell
   * those apart tells them the firm has no clients.
   *
   * Only meaningful for a lawyer. An admin reads every order without being
   * attached to anything, so an empty list for them means what it says.
   */
  hasAnyAssignment(): Promise<boolean>;
}
