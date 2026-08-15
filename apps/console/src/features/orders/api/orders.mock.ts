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

import {
  assignmentsOf,
  clientById,
  fixtureDelay,
  orderRows,
  profileById,
  serviceRows,
  serviceVersionRows,
} from "../../../shared/api/fixture-store";
import type { OrdersApi } from "./contract";
import type { OrderListItem, OrderReviewer } from "./types";

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
