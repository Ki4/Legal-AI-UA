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
 * Names for the actors on a page of events, by id.
 *
 * Absent from the map means no name is available — either the profile is
 * hidden from this reader by `profiles_select_staff`, or the row exists and its
 * `full_name` is null, which the column allows. Those two are collapsed
 * deliberately: they differ in cause and not in anything the reader can do,
 * since both leave an id and a role and no name. What must not collapse is
 * either of them into "nobody acted", and that distinction is made in
 * `toActor` from `actor_id` alone, before this map is consulted.
 */
export type ActorNames = ReadonlyMap<string, string>;

export function toActor(
  row: Pick<AuditEventQueryRow, "actor_id" | "actor_role">,
  names: ActorNames,
): HistoryActor {
  if (row.actor_id === null) return { kind: "system", roleAtTheTime: row.actor_role };

  const fullName = names.get(row.actor_id);
  if (fullName === undefined) {
    return { kind: "unnamed", id: row.actor_id, roleAtTheTime: row.actor_role };
  }

  return { kind: "person", id: row.actor_id, fullName, roleAtTheTime: row.actor_role };
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

async function namesOf(ids: readonly string[]): Promise<ActorNames> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);

  // Deliberately not fatal. A history whose actors are anonymous is worth
  // reading; a history that refuses to render because a name lookup failed is
  // not. The rows that came back are used and the rest fall through to
  // "unnamed", which is a state the screen already has to render.
  if (error) return new Map();

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.full_name !== null) names.set(row.id, row.full_name);
  }
  return names;
}

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

    const actorIds = [
      ...new Set(page.map((row) => row.actor_id).filter((id): id is string => id !== null)),
    ];

    const names = await namesOf(actorIds);

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
