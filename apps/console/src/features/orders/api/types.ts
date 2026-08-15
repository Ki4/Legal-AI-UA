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

import type {
  AuditAction,
  EntitlementKind,
  GenerationMode,
  OrderStatus,
  ReviewMode,
  ServiceStatus,
} from "@legal-ai/db";
import type { AuditActor } from "../../../shared/audit";

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

// The card (§4.16) ------------------------------------------------------------

/**
 * What the order will be delivered under, and this is where ADR-0019's silent
 * refusal becomes something a reader can act on.
 *
 * `orders.entitlement_id` is a column of `orders`, so a lawyer reads it. The
 * `entitlements` row it points at is administration, so a lawyer does not
 * (§8.6). Those are two different absences and the screen must not render them
 * alike: nothing bought yet is a fact about the order, while "recorded, and not
 * yours to read" is a fact about the reader.
 *
 * - `none` — no entitlement recorded. The order is still in intake.
 * - `withheld` — one is recorded, and this reader may not see which. The right
 *   sentence is about who may read it, never a blank that reads as `none`.
 * - `known` — recorded and readable, which today means an admin is looking.
 */
export type OrderEntitlement =
  | { kind: "none" }
  | { kind: "withheld" }
  | {
      kind: "known";
      id: string;
      entitlementKind: EntitlementKind;
      /** Null on a one-off, whose validity ends when the law moves (§8.1). */
      validUntil: string | null;
      revokedAt: string | null;
    };

/**
 * The frozen version this order was placed against (§5.4, ADR-0009).
 *
 * `frozen` is carried rather than derived on the screen, because it is the
 * thing that makes the pin mean anything: a version id proves nothing if what
 * sits behind it could still change. A published version cannot, and a reader
 * looking at a document's origin needs to be told that rather than to know it.
 */
export interface PinnedVersion {
  serviceId: string;
  serviceTitle: string;
  versionId: string;
  version: number;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  frozen: boolean;
}

/**
 * One entry of the timeline, which is a read of `audit_events` and not a second
 * history (ADR-0010). §6.1 is explicit that current status is a projection of
 * this log, so `statusAfter` is what makes the timeline say "moved to review"
 * rather than "changed two columns".
 */
export interface OrderEvent {
  id: number;
  occurredAt: string;
  action: AuditAction;
  changedColumns: string[];
  /** The state the order was left in, when this event changed it. */
  statusAfter: OrderStatus | null;
  actor: AuditActor;
}

export interface OrderCard {
  id: string;
  clientPseudonym: string;
  status: OrderStatus;
  humanReviewRequested: boolean;
  reviewer: OrderReviewer;
  entitlement: OrderEntitlement;
  pinned: PinnedVersion;

  placedAt: string;
  submittedAt: string | null;
  deliveredAt: string | null;
  /** Set when the order ended without delivery — cancelled or abandoned. */
  closedAt: string | null;

  /** Newest first, like the history screen. */
  timeline: OrderEvent[];
}
