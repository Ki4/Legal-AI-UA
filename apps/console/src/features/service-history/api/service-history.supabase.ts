// Supabase implementation of ServiceHistoryApi.
//
// Two queries and a join done here rather than in the database, because the
// database cannot do it: `audit_events` has no foreign keys on purpose
// (ADR-0010 — evidence a cascade can reshape is not evidence), so there is no
// relationship for PostgREST to embed a profile through. The actor's name is
// therefore fetched separately and matched up in this layer, which is what the
// layer is for.
//
// Three queries in total when the actors are known, and the third is the cheap
// one: `services` is asked for the title first so that a mistyped id is a
// "not found" rather than an empty history (DoD §4).
//
// The mapping below is exported so it can be tested without a database.

import type { QueryData } from "@supabase/supabase-js";
import { asAuditedTable } from "@legal-ai/db";
import { supabase } from "../../../app/supabase";
import { namesOf } from "../../../shared/api/actor-names";
import { actorFrom, actorIdsOf, type ActorNames } from "../../../shared/audit";
import { AppError } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { ServiceHistoryApi } from "./contract";
import type { HistoryActor, ServiceHistoryEvent } from "./types";

// `before` and `after` are not selected. They are the largest columns in the
// table and this screen renders neither, so asking for them would move whole
// row snapshots across the network to be dropped on arrival — and would put
// payloads that a future client-bearing table will fill in front of a screen
// that has no business holding them (§6.4).
const SELECT = `
  id, occurred_at, actor_id, actor_role, action, entity_table, entity_id, changed_columns
` as const;

function historyQuery() {
  return supabase.from("audit_events").select(SELECT);
}

export type AuditEventQueryRow = QueryData<ReturnType<typeof historyQuery>>[number];

/**
 * Kept as a thin wrapper over the shared resolver so the tests that name this
 * function keep naming something, and so a reader of this file still sees where
 * the actor comes from. The rules themselves live in `shared/api/audit.ts` —
 * the order card reads the same log and must not hold a second copy of them.
 */
export function toActor(
  row: Pick<AuditEventQueryRow, "actor_id" | "actor_role">,
  names: ActorNames,
): HistoryActor {
  return actorFrom(row, names);
}

export function toHistoryEvent(row: AuditEventQueryRow, names: ActorNames): ServiceHistoryEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    entity: asAuditedTable(row.entity_table),
    entityTable: row.entity_table,
    entityId: row.entity_id,
    // Null for an insert and a delete, where the whole row is the change. An
    // empty array says the same thing to a screen without every reader of the
    // view model having to handle a second absence.
    changedColumns: row.changed_columns ?? [],
    actor: toActor(row, names),
  };
}

// `ActorNames` is re-exported because this module's tests name it, and because
// a reader of `toHistoryEvent`'s signature should be able to follow the type
// without leaving the file they are in.
export type { ActorNames };

export const supabaseServiceHistoryApi: ServiceHistoryApi = {
  async get(serviceId, limit) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, title")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) throw fromPostgrest(serviceError, "Loading service history");
    if (service === null) {
      // Indistinguishable from "exists but RLS hides it", and deliberately so:
      // telling an unauthorised caller that a record exists is itself a leak.
      throw new AppError("not_found", `No service with id ${serviceId}.`);
    }

    // One past the limit, so "there is more" is something the data said rather
    // than something a full page implied.
    //
    // Both orderings matter. `occurred_at` defaults to `now()`, which is
    // transaction time, so every event written by one statement shares a
    // timestamp to the microsecond — ordering by it alone leaves their sequence
    // to the planner, and a log that reshuffles between loads is not a log
    // (DoD §5). `id` is the identity column and settles it.
    const { data, error } = await historyQuery()
      .eq("service_id", serviceId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (error) throw fromPostgrest(error, "Loading service history");

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const names = await namesOf(actorIdsOf(page));

    return {
      serviceId: service.id,
      serviceTitle: service.title,
      events: page.map((row) => toHistoryEvent(row, names)),
      hasMore,
    };
  },

  async isAttached(serviceId) {
    // The RPC rather than a query against `service_assignments`, because this is
    // the same function `audit_events_select_assigned_lawyer` calls. Asking the
    // policy's own predicate is what stops the screen's idea of "attached" and
    // the database's from drifting apart — and a drift here is silent, since
    // both answers are an empty list.
    const { data, error } = await supabase.rpc("is_assigned_to", { target_service: serviceId });

    if (error) throw fromPostgrest(error, "Checking the assignment");
    return data === true;
  },
};
