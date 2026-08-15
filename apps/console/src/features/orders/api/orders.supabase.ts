// Supabase implementation of OrdersApi.
//
// One query, unlike the service history's three. `orders` has real foreign keys
// — to `clients`, to `service_versions`, to `profiles` — so PostgREST can embed
// what the list needs, and the nesting through `service_versions` to `services`
// is the pinning rule showing up in the query shape: there is no path from an
// order to a service that does not go through the version it pinned (§5.4).
//
// The mapping is exported so it can be tested without a database.

import type { QueryData } from "@supabase/supabase-js";
import type { AuditAction } from "@legal-ai/db";
import { supabase } from "../../../app/supabase";
import { fromPostgrest } from "../../../shared/api/postgrest";
import { namesOf } from "../../../shared/api/actor-names";
import { actorFrom, actorIdsOf, type ActorNames } from "../../../shared/audit";
import { AppError } from "../../../shared/api/errors";
import type { OrdersApi } from "./contract";
import { toStatusAfter } from "./status";
import type {
  OrderCard,
  OrderEntitlement,
  OrderEvent,
  OrderListItem,
  OrderReviewer,
  PinnedVersion,
} from "./types";

// `entitlement_id` is not selected. A lawyer may read the column and may not
// read the row it points at (ADR-0019), so on this screen it could only ever
// render as a uuid or as nothing. The card gives it a view model that says
// which of those two the reader is in; a list has no room for that sentence.
const SELECT = `
  id, client_id, status, human_review_requested, reviewer_id, placed_at,
  clients ( pseudonym ),
  service_versions ( version, service_id, services ( title ) ),
  profiles ( id, full_name )
` as const;

function ordersQuery() {
  return supabase.from("orders").select(SELECT);
}

export type OrderQueryRow = QueryData<ReturnType<typeof ordersQuery>>[number];

/**
 * The three reviewer states, decided from `reviewer_id` first and the embedded
 * profile second — in that order, because the order is the whole point.
 *
 * An embed hidden by RLS arrives as null, exactly like an embed that was never
 * there. Reading the embed alone would collapse "nobody has taken this" into
 * "somebody has, and you cannot see who", and a lawyer would be told an order
 * is unclaimed while a colleague is working on it (DoD §5).
 */
export function toReviewer(row: Pick<OrderQueryRow, "reviewer_id" | "profiles">): OrderReviewer {
  if (row.reviewer_id === null) return { kind: "none" };

  const fullName = row.profiles?.full_name ?? null;
  if (fullName === null) return { kind: "unnamed", id: row.reviewer_id };

  return { kind: "person", id: row.reviewer_id, fullName };
}

/**
 * Bad data renders as visibly odd text rather than taking the screen down
 * (DoD §5, formatters are total).
 *
 * The optional chaining below guards states the generated types say cannot
 * happen, and it stays. `pnpm db:types` writes these to-one embeds as
 * non-nullable because the foreign keys are `not null`, which is everything
 * referential integrity can tell it — and nothing about RLS. PostgREST returns
 * `null` for an embedded row the reader may not see whatever the key says, so
 * narrowing `clients_select_staff` in some later migration would produce a null
 * here that no type ever admitted was possible. A screen with no
 * `ErrorBoundary` cannot afford to meet that as a throw.
 */
export function toOrderListItem(row: OrderQueryRow): OrderListItem {
  const version = row.service_versions;

  return {
    id: row.id,
    clientPseudonym: row.clients?.pseudonym ?? row.client_id,
    serviceId: version?.service_id ?? "",
    serviceTitle: version?.services?.title ?? "",
    version: version?.version ?? 0,
    status: row.status,
    humanReviewRequested: row.human_review_requested,
    reviewer: toReviewer(row),
    placedAt: row.placed_at,
  };
}

export const supabaseOrdersApi: OrdersApi = {
  get: (orderId) => supabaseOrderCard.get(orderId),

  async list(limit) {
    // One past the limit, so "there is more" is something the data said rather
    // than something a full page implied.
    //
    // Both orderings matter, for the reason the history screen found: several
    // orders written by one statement share `placed_at` to the microsecond, and
    // ordering by it alone leaves their sequence to the planner. `id` settles
    // it — a uuid, so the tie-break is arbitrary but stable, which is what a
    // list that must not reshuffle between loads actually needs.
    const { data, error } = await ordersQuery()
      .order("placed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (error) throw fromPostgrest(error, "Loading orders");

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return { orders: page.map(toOrderListItem), hasMore };
  },

  async hasAnyAssignment() {
    // Filtered by the caller's own id rather than trusting the policy to do it:
    // `service_assignments_select_staff` lets any member of staff read every
    // assignment, which is right for the team screen and would make this
    // question answer "yes" for everybody.
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (userId === undefined) return false;

    const { count, error } = await supabase
      .from("service_assignments")
      .select("service_id", { count: "exact", head: true })
      .eq("lawyer_id", userId);

    if (error) throw fromPostgrest(error, "Checking the assignments");
    return (count ?? 0) > 0;
  },
};

// The card (§4.16) ------------------------------------------------------------
//
// Two queries plus the names. The order is asked for first so that a mistyped
// id is a "not found" rather than an order with an empty timeline (DoD §4).
//
// The timeline selects `after->>status` and never `after` itself. The service
// history omits the payload entirely, with the reason that it would put row
// snapshots in front of a screen that renders none of them (§6.4); this screen
// genuinely needs one field, so it asks for the field. An order payload holds
// no personal data either way — that is what ADM-62's split bought — but
// "select the column you render" survives the day a payload stops being safe,
// and "select the payload and pick" does not.

const CARD_SELECT = `
  id, client_id, status, human_review_requested, reviewer_id, entitlement_id,
  placed_at, submitted_at, delivered_at, closed_at,
  clients ( pseudonym ),
  service_versions (
    id, version, status, generation_mode, review_mode, published_at, service_id,
    services ( title )
  ),
  profiles ( id, full_name ),
  entitlements ( id, kind, valid_until, revoked_at )
` as const;

function cardQuery() {
  return supabase.from("orders").select(CARD_SELECT);
}

export type OrderCardQueryRow = QueryData<ReturnType<typeof cardQuery>>[number];

/**
 * The three entitlement states, decided from the id first and the embed second
 * — the same order, and for the same reason, as the reviewer above.
 *
 * This is ADR-0019's silent refusal arriving on a screen. A lawyer may read
 * `entitlement_id` because it is a column of `orders`, and may not read the
 * `entitlements` row because that is administration. PostgREST returns null for
 * the embed either way, so reading the embed alone would tell a lawyer that
 * nothing has been bought — about an order that has been paid for.
 */
export function toEntitlement(
  row: Pick<OrderCardQueryRow, "entitlement_id" | "entitlements">,
): OrderEntitlement {
  if (row.entitlement_id === null) return { kind: "none" };

  const entitlement = row.entitlements;
  if (entitlement === null || entitlement === undefined) return { kind: "withheld" };

  return {
    kind: "known",
    id: entitlement.id,
    entitlementKind: entitlement.kind,
    validUntil: entitlement.valid_until,
    revokedAt: entitlement.revoked_at,
  };
}

export function toPinnedVersion(row: OrderCardQueryRow): PinnedVersion {
  const version = row.service_versions;

  return {
    serviceId: version?.service_id ?? "",
    serviceTitle: version?.services?.title ?? "",
    versionId: version?.id ?? "",
    version: version?.version ?? 0,
    status: version?.status ?? "draft",
    generationMode: version?.generation_mode ?? "template",
    reviewMode: version?.review_mode ?? "lawyer_required",
    // Frozen is what makes the pin mean anything (§5.4). Derived from
    // `published_at` rather than from `status`, because a version that has been
    // published and later archived is still frozen — the status moved, the
    // content did not.
    frozen: version?.published_at != null,
  };
}

const TIMELINE_SELECT = `
  id, occurred_at, actor_id, actor_role, action, changed_columns, after->>status
` as const;

export interface TimelineQueryRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: string | null;
  action: AuditAction;
  changed_columns: string[] | null;
  status: unknown;
}

export function toOrderEvent(row: TimelineQueryRow, names: ActorNames): OrderEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    changedColumns: row.changed_columns ?? [],
    statusAfter: toStatusAfter(row.status),
    actor: actorFrom(row, names),
  };
}

export const supabaseOrderCard = {
  async get(orderId: string): Promise<OrderCard> {
    const { data: row, error } = await cardQuery().eq("id", orderId).maybeSingle();

    if (error) throw fromPostgrest(error, "Loading the order");
    if (row === null) {
      // Indistinguishable from "exists and is not yours", and deliberately so:
      // the reader named this order, and confirming that a named record exists
      // is itself a leak.
      throw new AppError("not_found", `No order with id ${orderId}.`);
    }

    // Ordered by timestamp *and* id, for the reason the history screen found:
    // events written by one statement share `occurred_at` to the microsecond,
    // and a log that reshuffles between loads is not a log.
    const { data: events, error: timelineError } = await supabase
      .from("audit_events")
      .select(TIMELINE_SELECT)
      .eq("entity_table", "orders")
      .eq("entity_id", orderId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false });

    if (timelineError) throw fromPostgrest(timelineError, "Loading the order timeline");

    const timeline = (events ?? []) as unknown as TimelineQueryRow[];
    const names = await namesOf(actorIdsOf(timeline));

    return {
      id: row.id,
      clientPseudonym: row.clients?.pseudonym ?? row.client_id,
      status: row.status,
      humanReviewRequested: row.human_review_requested,
      reviewer: toReviewer(row),
      entitlement: toEntitlement(row),
      pinned: toPinnedVersion(row),
      placedAt: row.placed_at,
      submittedAt: row.submitted_at,
      deliveredAt: row.delivered_at,
      closedAt: row.closed_at,
      timeline: timeline.map((event) => toOrderEvent(event, names)),
    };
  },
};
