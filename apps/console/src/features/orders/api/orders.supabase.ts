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
import { supabase } from "../../../app/supabase";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { OrdersApi } from "./contract";
import type { OrderListItem, OrderReviewer } from "./types";

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
