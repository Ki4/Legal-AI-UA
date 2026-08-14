// The live implementation's testable half.
//
// Two things are checked here that the fixture implementation cannot show,
// because they are properties of the query rather than of the data: that the
// log is asked for one row past the limit, and that it is ordered by timestamp
// *and* id. Both are decisions this file makes and neither leaves a trace in
// the rows that come back, so a test that only looked at the output would pass
// with either of them removed.
//
// The rest is the row → view model translation, which is where the actor
// states live.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  supabaseServiceHistoryApi,
  toActor,
  toHistoryEvent,
  type ActorNames,
  type AuditEventQueryRow,
} from "./service-history.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest. So the client is replaced here
// rather than configured. Same shape as the service-detail stub next door: a
// queue of answers, because `get` runs three queries in a row, and a record of
// calls, because the two decisions above are expressed as query arguments and
// cannot be observed any other way.
interface StubResult {
  data: unknown;
  error: unknown;
}

interface Chain {
  select: (...args: unknown[]) => Chain;
  eq: (...args: unknown[]) => Chain;
  in: (...args: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain;
  limit: (...args: unknown[]) => Chain;
  maybeSingle: () => Chain;
  then: (resolve: (value: StubResult) => unknown) => Promise<unknown>;
}

const stub = vi.hoisted(() => ({
  queue: [] as { data: unknown; error: unknown }[],
  calls: [] as { table: string; op: string; args: unknown[] }[],
}));

vi.mock("../../../app/supabase", () => {
  const take = (): StubResult => stub.queue.shift() ?? { data: null, error: null };

  const makeChain = (table: string): Chain => {
    const record = (op: string, args: unknown[]): Chain => {
      stub.calls.push({ table, op, args });
      return chain;
    };
    const chain: Chain = {
      select: (...args) => record("select", args),
      eq: (...args) => record("eq", args),
      in: (...args) => record("in", args),
      order: (...args) => record("order", args),
      limit: (...args) => record("limit", args),
      maybeSingle: () => chain,
      then: (resolve) => Promise.resolve(take()).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => makeChain(table),
      rpc: (name: string, args: unknown) => {
        stub.calls.push({ table: "rpc", op: name, args: [args] });
        return Promise.resolve(take());
      },
    },
  };
});

beforeEach(() => {
  stub.queue = [];
  stub.calls = [];
});

const SERVICE = { id: "svc-1", title: "Divorce application" };

function event(overrides: Partial<AuditEventQueryRow> = {}): AuditEventQueryRow {
  return {
    id: 1,
    occurred_at: "2026-08-11T09:00:00.000Z",
    actor_id: "usr-admin",
    actor_role: "admin",
    action: "update",
    entity_table: "services",
    entity_id: "svc-1",
    changed_columns: ["title"],
    ...overrides,
  };
}

const NAMES: ActorNames = new Map([["usr-admin", "Iryna Shevchenko"]]);

describe("toActor", () => {
  it("names an actor whose profile came back", () => {
    expect(toActor({ actor_id: "usr-admin", actor_role: "admin" }, NAMES)).toEqual({
      kind: "person",
      id: "usr-admin",
      fullName: "Iryna Shevchenko",
      roleAtTheTime: "admin",
    });
  });

  it("keeps the id and the role when there is no name", () => {
    // A profile RLS hides, or one whose `full_name` is null. The reader still
    // learns that somebody with the rights of a lawyer did this.
    expect(toActor({ actor_id: "usr-gone", actor_role: "lawyer" }, NAMES)).toEqual({
      kind: "unnamed",
      id: "usr-gone",
      roleAtTheTime: "lawyer",
    });
  });

  it("does not turn a missing name into a missing actor", () => {
    // The distinction that matters: `system` is reserved for a null actor_id —
    // a migration or a job, where `auth.uid()` genuinely is null. An actor with
    // no readable name is still an actor.
    const unnamed = toActor({ actor_id: "usr-gone", actor_role: null }, NAMES);
    const system = toActor({ actor_id: null, actor_role: null }, NAMES);

    expect(unnamed.kind).toBe("unnamed");
    expect(system).toEqual({ kind: "system", roleAtTheTime: null });
  });
});

describe("toHistoryEvent", () => {
  it("maps a table it has a word for", () => {
    expect(toHistoryEvent(event({ entity_table: "service_versions" }), NAMES).entity).toBe(
      "service_versions",
    );
  });

  it("leaves a table it does not, without losing its name", () => {
    const mapped = toHistoryEvent(event({ entity_table: "service_law_references" }), NAMES);

    expect(mapped.entity).toBeNull();
    expect(mapped.entityTable).toBe("service_law_references");
  });

  it("turns the log's null columns into an empty list", () => {
    expect(toHistoryEvent(event({ changed_columns: null }), NAMES).changedColumns).toEqual([]);
  });
});

describe("supabaseServiceHistoryApi.get", () => {
  it("asks for one row past the limit and drops it", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [event({ id: 3 }), event({ id: 2 }), event({ id: 1 })], error: null },
      { data: [], error: null },
    ];

    const page = await supabaseServiceHistoryApi.get("svc-1", 2);

    const limit = stub.calls.find((call) => call.op === "limit");
    expect(limit?.args).toEqual([3]);
    // The third row was the question, not part of the answer.
    expect(page.events.map((entry) => entry.id)).toEqual([3, 2]);
    expect(page.hasMore).toBe(true);
  });

  it("does not claim there is more when the last page is exactly full", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [event({ id: 2 }), event({ id: 1 })], error: null },
      { data: [], error: null },
    ];

    const page = await supabaseServiceHistoryApi.get("svc-1", 2);

    expect(page.events).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("orders by time and then by id", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [], error: null },
    ];

    await supabaseServiceHistoryApi.get("svc-1", 50);

    // Every event written by one statement shares `occurred_at` to the
    // microsecond, because the default is `now()` and that is transaction time.
    // Without the second ordering their sequence is the planner's choice, and a
    // log that reshuffles between loads is not a log.
    expect(stub.calls.filter((call) => call.op === "order").map((call) => call.args)).toEqual([
      ["occurred_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });

  it("refuses an id no service has, rather than reporting an empty history", async () => {
    stub.queue = [{ data: null, error: null }];

    await expect(supabaseServiceHistoryApi.get("svc-nope", 50)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("does not ask for names when there are no named actors", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [event({ actor_id: null, actor_role: null })], error: null },
    ];

    const page = await supabaseServiceHistoryApi.get("svc-1", 50);

    expect(stub.calls.some((call) => call.table === "profiles")).toBe(false);
    expect(page.events[0]?.actor.kind).toBe("system");
  });

  it("asks for each actor once, however many events they left", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [event({ id: 2 }), event({ id: 1 })], error: null },
      { data: [{ id: "usr-admin", full_name: "Iryna Shevchenko" }], error: null },
    ];

    await supabaseServiceHistoryApi.get("svc-1", 50);

    const lookup = stub.calls.find((call) => call.table === "profiles" && call.op === "in");
    expect(lookup?.args).toEqual(["id", ["usr-admin"]]);
  });

  it("renders an anonymous history rather than no history when the names fail", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: [event()], error: null },
      { data: null, error: { code: "42501", message: "permission denied" } },
    ];

    const page = await supabaseServiceHistoryApi.get("svc-1", 50);

    // A history whose actors are anonymous is worth reading. One that refuses
    // to render because a name lookup failed is not — and `unnamed` is a state
    // the screen already has to draw.
    expect(page.events[0]?.actor).toEqual({
      kind: "unnamed",
      id: "usr-admin",
      roleAtTheTime: "admin",
    });
  });

  it("reports a failed event query rather than an empty log", async () => {
    stub.queue = [
      { data: SERVICE, error: null },
      { data: null, error: { code: "PGRST301", message: "JWT expired" } },
    ];

    await expect(supabaseServiceHistoryApi.get("svc-1", 50)).rejects.toMatchObject({
      code: "unknown",
    });
  });
});

describe("supabaseServiceHistoryApi.isAttached", () => {
  it("asks the same function the policy asks", async () => {
    stub.queue = [{ data: true, error: null }];

    await expect(supabaseServiceHistoryApi.isAttached("svc-1")).resolves.toBe(true);
    expect(stub.calls[0]).toEqual({
      table: "rpc",
      op: "is_assigned_to",
      args: [{ target_service: "svc-1" }],
    });
  });

  it("is false rather than null when the answer is no", async () => {
    stub.queue = [{ data: false, error: null }];

    await expect(supabaseServiceHistoryApi.isAttached("svc-1")).resolves.toBe(false);
  });

  it("does not read a failure as an answer", async () => {
    // Returning false here would render "you may not see this" over a request
    // that never got a verdict.
    stub.queue = [{ data: null, error: { code: "42501", message: "permission denied" } }];

    await expect(supabaseServiceHistoryApi.isAttached("svc-1")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
