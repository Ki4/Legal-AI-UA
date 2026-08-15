// Fixture implementation, annotated with the contract so drift fails to compile
// (ADR-0012, DoD §2).
//
// It does the same work the Supabase one does, in the same order and by the
// same rules — sort by `placed_at` then by id, take one past the limit, decide
// the reviewer from the id before the profile. That is the point of keeping it:
// those rules are assertable without a database, and any implementation of the
// contract is checked against the same behaviour.
//
// What it cannot stand in for is RLS. The fixture store has no policies, so
// every order is visible here and `hasAnyAssignment` answers from the same
// assignment rows the real one queries. The states that only RLS produces — a
// lawyer seeing an empty list because none of it is theirs — are asserted at
// the component, where the api is mocked outright.

import { actorFrom, actorIdsOf, type ActorNames } from "../../../shared/audit";
import { AppError } from "../../../shared/api/errors";
import {
  assignmentsOf,
  clientById,
  entitlementById,
  fixtureDelay,
  orderEventRows,
  orderRows,
  profileById,
  serviceRows,
  serviceVersionRows,
} from "../../../shared/api/fixture-store";
import { toStatusAfter } from "./status";
import type { OrdersApi } from "./contract";
import type {
  OrderCard,
  OrderEntitlement,
  OrderEvent,
  OrderListItem,
  OrderReviewer,
} from "./types";

/**
 * Who the fixtures are pretending to be signed in as. A fixture store has no
 * session, and `hasAnyAssignment` is a question about the caller, so one has to
 * be named somewhere. Olena is accountable for `svc-divorce`, which makes the
 * answer here `true` — the `false` branch is a lawyer attached to nothing, and
 * it is asserted in the test by asking about somebody who is.
 */
const FIXTURE_CALLER = "usr-olena";

function toReviewer(reviewerId: string | null): OrderReviewer {
  if (reviewerId === null) return { kind: "none" };

  // `profileById` returns null for an id no profile row has — the fixture
  // equivalent of a profile RLS hides — and a row whose `full_name` is null is
  // the other way to have no name. Both land on `unnamed`, as they do live.
  const fullName = profileById(reviewerId)?.full_name ?? null;
  if (fullName === null) return { kind: "unnamed", id: reviewerId };

  return { kind: "person", id: reviewerId, fullName };
}

function toListItem(row: (typeof orderRows)[number]): OrderListItem {
  const version = serviceVersionRows.find((candidate) => candidate.id === row.service_version_id);
  const service =
    version === undefined
      ? undefined
      : serviceRows.find((candidate) => candidate.id === version.service_id);

  return {
    id: row.id,
    clientPseudonym: clientById(row.client_id)?.pseudonym ?? row.client_id,
    serviceId: version?.service_id ?? "",
    serviceTitle: service?.title ?? "",
    version: version?.version ?? 0,
    status: row.status,
    humanReviewRequested: row.human_review_requested,
    reviewer: toReviewer(row.reviewer_id),
    placedAt: row.placed_at,
  };
}

export const mockOrdersApi: OrdersApi = {
  get: (orderId) => mockOrderCard.get(orderId),

  async list(limit) {
    await fixtureDelay();

    // Sorted here rather than relied on from the fixture array, because nothing
    // depends on array order (DoD §5) — including the fixture's own.
    const sorted = [...orderRows].sort((a, b) => {
      if (a.placed_at !== b.placed_at) return a.placed_at < b.placed_at ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });

    const hasMore = sorted.length > limit;
    const page = hasMore ? sorted.slice(0, limit) : sorted;

    return { orders: page.map(toListItem), hasMore };
  },

  async hasAnyAssignment() {
    await fixtureDelay();
    return serviceRows.some((service) =>
      assignmentsOf(service.id).some((row) => row.lawyer_id === FIXTURE_CALLER),
    );
  },
};

// The card ---------------------------------------------------------------------
//
// The same rules as the Supabase implementation, decided in the same order: the
// entitlement from the order's own column before the entitlement row, the
// reviewer from the id before the profile. Both are the shape ADR-0019 forces —
// an absence on the order and an absence in front of the reader are different
// facts, and the fixture store reproduces the second by simply not having the
// row, which is what RLS does.

function toEntitlement(entitlementId: string | null): OrderEntitlement {
  if (entitlementId === null) return { kind: "none" };

  const row = entitlementById(entitlementId);
  if (row === null) return { kind: "withheld" };

  return {
    kind: "known",
    id: row.id,
    entitlementKind: row.kind,
    validUntil: row.valid_until,
    revokedAt: row.revoked_at,
  };
}

function toEvent(row: (typeof orderEventRows)[number], names: ActorNames): OrderEvent {
  const after = row.after as { status?: unknown } | null;

  return {
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    changedColumns: row.changed_columns ?? [],
    statusAfter: toStatusAfter(after?.status),
    actor: actorFrom(row, names),
  };
}

export const mockOrderCard = {
  async get(orderId: string): Promise<OrderCard> {
    await fixtureDelay();

    const row = orderRows.find((candidate) => candidate.id === orderId);
    if (row === undefined) {
      throw new AppError("not_found", `No order with id ${orderId}.`);
    }

    const version = serviceVersionRows.find((candidate) => candidate.id === row.service_version_id);
    const service =
      version === undefined
        ? undefined
        : serviceRows.find((candidate) => candidate.id === version.service_id);

    const events = orderEventRows
      .filter((event) => event.entity_id === orderId)
      // Sorted here rather than taken from the fixture array, because nothing
      // depends on array order (DoD §5) — including the fixture's own.
      .sort((a, b) => {
        if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? 1 : -1;
        return b.id - a.id;
      });

    const names = new Map<string, string>();
    for (const id of actorIdsOf(events)) {
      const fullName = profileById(id)?.full_name ?? null;
      if (fullName !== null) names.set(id, fullName);
    }

    return {
      id: row.id,
      clientPseudonym: clientById(row.client_id)?.pseudonym ?? row.client_id,
      status: row.status,
      humanReviewRequested: row.human_review_requested,
      reviewer: toReviewer(row.reviewer_id),
      entitlement: toEntitlement(row.entitlement_id),
      pinned: {
        serviceId: version?.service_id ?? "",
        serviceTitle: service?.title ?? "",
        versionId: version?.id ?? "",
        version: version?.version ?? 0,
        status: version?.status ?? "draft",
        generationMode: version?.generation_mode ?? "template",
        reviewMode: version?.review_mode ?? "lawyer_required",
        frozen: version?.published_at != null,
      },
      placedAt: row.placed_at,
      submittedAt: row.submitted_at,
      deliveredAt: row.delivered_at,
      closedAt: row.closed_at,
      timeline: events.map((event) => toEvent(event, names)),
    };
  },
};
