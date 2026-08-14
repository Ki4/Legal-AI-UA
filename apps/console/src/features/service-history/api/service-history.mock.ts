// Fixture implementation, annotated with the contract so drift fails to compile
// (ADR-0012, DoD §2).
//
// It does the same work the Supabase one does, in the same order and with the
// same rules — sort by timestamp then by id, take one past the limit, resolve
// names separately and leave the unresolvable ones unnamed. That is the point
// of keeping it: the rules are asserted here without a database, and any
// implementation of the contract is checked against the same behaviour.

import { asAuditedTable } from "@legal-ai/db";
import type { AuditEventRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import {
  assignmentsOf,
  auditEventRows,
  fixtureDelay,
  profileById,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServiceHistoryApi } from "./contract";
import type { HistoryActor, ServiceHistoryEvent } from "./types";

/**
 * Who the fixtures are pretending to be signed in as.
 *
 * A fixture store has no session, and `isAttached` is a question about the
 * caller — so one has to be named somewhere. Olena is accountable for
 * `svc-divorce` and attached to nothing else, which gives the screen both
 * answers to work with: her own service, and a colleague's whose history she
 * cannot read.
 */
const FIXTURE_CALLER = "usr-olena";

function toActor(row: AuditEventRow): HistoryActor {
  if (row.actor_id === null) return { kind: "system", roleAtTheTime: row.actor_role };

  // `profileById` returns null for an id no profile row has — the fixture
  // equivalent of a profile RLS hides — and a row whose `full_name` is null is
  // the other way to have no name. Both land on `unnamed`, as they do live.
  const fullName = profileById(row.actor_id)?.full_name ?? null;
  if (fullName === null) {
    return { kind: "unnamed", id: row.actor_id, roleAtTheTime: row.actor_role };
  }

  return { kind: "person", id: row.actor_id, fullName, roleAtTheTime: row.actor_role };
}

function toEvent(row: AuditEventRow): ServiceHistoryEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    entity: asAuditedTable(row.entity_table),
    entityTable: row.entity_table,
    entityId: row.entity_id,
    changedColumns: row.changed_columns ?? [],
    actor: toActor(row),
  };
}

export const mockServiceHistoryApi: ServiceHistoryApi = {
  async get(serviceId, limit) {
    await fixtureDelay();

    const service = serviceRows.find((row) => row.id === serviceId) ?? null;
    if (service === null) throw new AppError("not_found", `No service with id ${serviceId}.`);

    // Sorted rather than assumed, exactly as the query is ordered. The fixture
    // array happens to be in chronological order and that is not something to
    // depend on (DoD §5) — nor is it the order this screen wants.
    const own = auditEventRows
      .filter((row) => row.service_id === serviceId)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id);

    const hasMore = own.length > limit;

    return {
      serviceId: service.id,
      serviceTitle: service.title,
      events: own.slice(0, limit).map(toEvent),
      hasMore,
    };
  },

  async isAttached(serviceId) {
    await fixtureDelay();
    return assignmentsOf(serviceId).some((row) => row.lawyer_id === FIXTURE_CALLER);
  },
};
