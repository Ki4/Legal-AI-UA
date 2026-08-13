// The live implementation's testable half.
//
// The query needs a running stack to mean anything and is checked by hand
// against the sandbox (see the PR description). What is tested here is what a
// database cannot answer: that a `text` column is narrowed rather than
// asserted, that "awaiting approval" is derived from the row, and that approval
// is two round trips — the RPC, then a read-back — because `approve_user`
// returns void and convention 5 asks for the updated entity.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import { supabaseTeamApi, toTeamMember, type TeamMemberQueryRow } from "./team.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest — so the client is replaced
// rather than configured. Same shape as the service-detail test next door.
interface StubResult {
  data: unknown;
  error: unknown;
}

interface Chain {
  select: (...args: unknown[]) => Chain;
  eq: (...args: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain;
  returns: () => Promise<StubResult>;
  then: (resolve: (value: StubResult) => unknown) => Promise<unknown>;
}

const stub = vi.hoisted(() => ({
  queue: [] as StubResult[],
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
      order: (...args) => record("order", args),
      returns: () => Promise.resolve(take()),
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

function row(overrides: Partial<TeamMemberQueryRow> = {}): TeamMemberQueryRow {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    email: "olena@example.test",
    full_name: "Olena Kovalchuk",
    role: "lawyer",
    created_at: "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("toTeamMember", () => {
  it("narrows the role column instead of asserting it", () => {
    // `profiles.role` is plain `text`. A row that says "wizard" is possible in
    // the type and impossible in the product, and the honest answer is the one
    // that does not claim a union the column cannot guarantee.
    expect(toTeamMember(row({ role: "wizard" })).role).toBeNull();
    expect(toTeamMember(row({ role: "lawyer" })).role).toBe("lawyer");
  });

  it("derives awaiting approval from the absent role", () => {
    expect(toTeamMember(row({ role: null })).awaitingApproval).toBe(true);
    expect(toTeamMember(row({ role: "admin" })).awaitingApproval).toBe(false);
  });

  it("treats an unrecognised role as awaiting approval, not as approved", () => {
    // The direction matters. A role the console does not understand must not
    // read as "approved, permissions unknown" — that would hide a member from
    // the queue while granting them a badge.
    const member = toTeamMember(row({ role: "wizard" }));

    expect(member.role).toBeNull();
    expect(member.awaitingApproval).toBe(true);
  });

  it("keeps the timestamp a string", () => {
    expect(toTeamMember(row()).joinedAt).toBe("2026-04-01T09:00:00.000Z");
  });
});

describe("list", () => {
  it("orders by registration date so the longest wait is first", async () => {
    stub.queue.push({ data: [row()], error: null });

    await supabaseTeamApi.list();

    expect(stub.calls).toContainEqual({
      table: "profiles",
      op: "order",
      args: ["created_at"],
    });
  });

  it("turns a Postgres error into an AppError", async () => {
    stub.queue.push({ data: null, error: { code: "42501", message: "denied" } });

    await expect(supabaseTeamApi.list()).rejects.toBeInstanceOf(AppError);
  });
});

describe("approve", () => {
  it("calls the RPC and then reads the member back", async () => {
    stub.queue.push({ data: null, error: null }); // the RPC
    stub.queue.push({ data: [row({ role: "admin" })], error: null }); // the read-back

    const updated = await supabaseTeamApi.approve("00000000-0000-0000-0000-0000000000a1", "admin");

    expect(stub.calls[0]).toEqual({
      table: "rpc",
      op: "approve_user",
      args: [{ target_user: "00000000-0000-0000-0000-0000000000a1", new_role: "admin" }],
    });
    expect(updated.role).toBe("admin");
    expect(updated.awaitingApproval).toBe(false);
  });

  it("does not read back when the RPC refused", async () => {
    stub.queue.push({ data: null, error: { code: "P0001", message: "only admins can approve" } });

    await expect(supabaseTeamApi.approve("usr-x", "lawyer")).rejects.toBeInstanceOf(AppError);

    // One call, not two: a failed approval must not report a member as
    // unchanged-and-fine by falling through to the read.
    expect(stub.calls.filter((call) => call.table === "profiles")).toEqual([]);
  });

  it("says the role was granted when only the read-back came back empty", async () => {
    stub.queue.push({ data: null, error: null }); // the RPC succeeded
    stub.queue.push({ data: [], error: null }); // and the row is not readable

    // The distinction this asserts: `approve_user` is SECURITY DEFINER and
    // returned without raising, so the write happened. Reporting "nothing was
    // written" here — which is what expectOne would have said — would be false.
    await expect(
      supabaseTeamApi.approve("00000000-0000-0000-0000-0000000000a1", "lawyer"),
    ).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("the role was granted"),
    });
  });
});
