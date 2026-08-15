// The contract. One implementation runs on fixtures, another on Postgres, and
// both are typed as `OrdersApi` so a drifting implementation fails to compile
// rather than failing in a browser (ADR-0012).

import type { OrderCard, OrdersPage } from "./types";

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

  /**
   * One order, with everything §4.16 renders and its timeline.
   *
   * Throws AppError("not_found") when there is no such order — which is also
   * what a reader gets for an order that exists and is not theirs, and that is
   * deliberate. `orders_select_staff` filters the row out, the query returns
   * nothing, and telling an unauthorised caller that a record exists is itself
   * a leak. The list is where the distinction between "none of these are yours"
   * and "there are none" is worth drawing, because there the reader has not
   * named a specific order.
   *
   * The timeline is a read of `audit_events`, not a second history (ADR-0010).
   * An order with an empty one is not possible today — the insert is itself an
   * event — but an empty array is an ordinary answer rather than an error, in
   * case the log is ever narrowed by a policy this screen cannot see.
   */
  get(orderId: string): Promise<OrderCard>;
}
