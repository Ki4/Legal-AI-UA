// View models for the orders list (spec §4.15). What the screen renders, not
// what `orders` holds (ADR-0012, convention 1).
//
// The table carries no personal data — `client_id` points at the ADM-62 anchor,
// whose pseudonym is the label §7.3 says a depersonalised screen shows — so
// there is nothing here to withhold and no "reveal" this screen could offer.
// That is a property of the schema, not a limitation of the view model.
//
// Two absences on purpose:
//
//   `clientId`. The screen shows the pseudonym and links by order id. Carrying
//   the anchor's uuid as well would put a second identifier for the same client
//   in front of a component that has no use for one, and the first thing
//   somebody would do with it is join on it.
//
//   `entitlementId`. It is on the row and a lawyer may read it, but they may
//   not read the entitlement it points at (ADR-0019). A bare id renders as
//   nothing useful and invites a lookup that will silently return empty. The
//   card (§4.16) is where the entitlement gets a view model that says which of
//   those two situations the reader is in.

import type { OrderStatus } from "@legal-ai/db";

/**
 * Who is answering for this order, in the three states the data can produce.
 * One field rather than a nullable name for the reason DoD §5 gives: "nobody
 * has taken this" and "somebody has, and you cannot see who" are different
 * facts, and a screen that renders both as a dash tells a lawyer an order is
 * unclaimed when it is not.
 *
 * - `none` — `reviewer_id` is null. Nobody has taken the matter.
 * - `unnamed` — a reviewer is recorded and their profile is not readable: a
 *   deactivated account, or a row `profiles_select_staff` hides.
 * - `person` — recorded and readable.
 */
export type OrderReviewer =
  | { kind: "none" }
  | { kind: "unnamed"; id: string }
  | { kind: "person"; id: string; fullName: string };

export interface OrderListItem {
  id: string;

  /** The label §7.3 shows instead of a person. Never a name. */
  clientPseudonym: string;

  /** The service the pinned version belongs to, for the link out of the list. */
  serviceId: string;
  serviceTitle: string;

  /**
   * The pinned version's number, not the service's current one. An order placed
   * against v1 keeps saying v1 after the service republishes twice, which is
   * the whole of §5.4 as a reader meets it.
   */
  version: number;

  status: OrderStatus;

  /**
   * The client asked for a human on a version that did not require one
   * (Art. 22, ADR-0005). Shown beside the state because it changes what the
   * state means: `generating` with this set cannot become `delivered` without
   * passing through review.
   */
  humanReviewRequested: boolean;

  reviewer: OrderReviewer;

  /** ISO 8601 (ADR-0012, convention 2). */
  placedAt: string;
}

export interface OrdersPage {
  /** Newest first. */
  orders: OrderListItem[];

  /**
   * Whether more orders exist than were asked for. Answered by fetching one row
   * past the limit and dropping it, so it is a fact about the data rather than
   * a guess from a full page.
   */
  hasMore: boolean;
}
