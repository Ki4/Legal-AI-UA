// The live implementation's testable half.
//
// The query itself needs a running stack to mean anything and is verified by
// hand against the sandbox (see the PR description). What is tested here is the
// row → view model translation, because that is where the decisions are: which
// version the card reflects, which null means what, and what an absent price
// says. All of them are decidable from a row literal, and every one of them was
// got wrong at least once in the reference implementation.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  supabaseServiceDetailApi,
  toServiceDetail,
  type ServiceDetailQueryRow,
} from "./service-detail.supabase";

// `app/supabase.ts` builds its client at import time and throws when the env
// vars are absent, which they are under Vitest. So the client is replaced here
// rather than configured — which is also why the reference implementation has
// no test of its own. `vi.hoisted` is what lets the factory below reach a
// variable declared in this file: `vi.mock` is lifted above the imports.
interface StubResult {
  data: unknown;
  error: unknown;
}

interface Chain {
  select: (...args: unknown[]) => Chain;
  eq: (...args: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain;
  insert: (...args: unknown[]) => Chain;
  delete: (...args: unknown[]) => Chain;
  maybeSingle: () => Chain;
  returns: () => Promise<StubResult>;
  then: (resolve: (value: StubResult) => unknown) => Promise<unknown>;
}

// A queue rather than one result: the mutations round-trip — write, then re-read
// through `get` — so a single stubbed answer would feed the insert's rows back
// into the mapper and fail for a reason that has nothing to do with the code.
//
// `calls` is recorded because two decisions in this file are expressed as query
// *filters* and cannot be observed any other way: that cover removal never
// touches the accountable row, and that the picker asks for lawyers only.
const stub = vi.hoisted(() => ({
  queue: [] as { data: unknown; error: unknown }[],
  calls: [] as { table: string; op: string; args: unknown[] }[],
}));

vi.mock("../../../app/supabase", () => {
  const take = (): StubResult => stub.queue.shift() ?? { data: null, error: null };

  // Every builder method returns the same object, so the call chain in the
  // implementation resolves regardless of the order it is written in. `then`
  // makes the chain itself awaitable, which is how PostgREST terminates a query
  // that has no `.returns()` on the end.
  const makeChain = (table: string): Chain => {
    const record = (op: string, args: unknown[]): Chain => {
      stub.calls.push({ table, op, args });
      return chain;
    };
    const chain: Chain = {
      select: (...args) => record("select", args),
      eq: (...args) => record("eq", args),
      order: (...args) => record("order", args),
      insert: (...args) => record("insert", args),
      delete: (...args) => record("delete", args),
      maybeSingle: () => chain,
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

function row(overrides: Partial<ServiceDetailQueryRow> = {}): ServiceDetailQueryRow {
  return {
    id: "20000000-0000-0000-0000-000000000001",
    slug: "divorce-application",
    title: "Divorce application",
    summary: "Application to dissolve a marriage.",
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-11T09:00:00.000Z",
    service_assignments: [],
    service_versions: [],
    ...overrides,
  };
}

function version(
  over: Partial<ServiceDetailQueryRow["service_versions"][number]> = {},
): ServiceDetailQueryRow["service_versions"][number] {
  return {
    id: "30000000-0000-0000-0000-000000000001",
    version: 1,
    status: "draft",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: null,
    service_version_prices: [],
    ...over,
  };
}

describe("toServiceDetail", () => {
  it("carries the fields the card needs and the list row does not", () => {
    const detail = toServiceDetail(row());
    expect(detail.summary).toBe("Application to dissolve a marriage.");
    expect(detail.createdAt).toBe("2026-08-01T09:00:00.000Z");
    expect(detail.updatedAt).toBe("2026-08-11T09:00:00.000Z");
  });

  describe("which version the card reflects", () => {
    it("prefers the live version over a higher-numbered draft", () => {
      // The case that makes "newest" wrong on its own: work on v2 is in
      // progress while v1 is what clients are actually being served.
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({
              id: "v1",
              version: 1,
              status: "published",
              published_at: "2026-08-05T00:00:00.000Z",
            }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.version).toBe(1);
      expect(detail.currentVersion?.publishedAt).toBe("2026-08-05T00:00:00.000Z");
    });

    it("counts a paused version as live", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ id: "v1", version: 1, status: "paused" }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.status).toBe("paused");
    });

    it("falls back to the newest when nothing is live", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ id: "v1", version: 1, status: "archived" }),
            version({ id: "v2", version: 2, status: "draft" }),
          ],
        }),
      );
      expect(detail.currentVersion?.version).toBe(2);
    });

    it("does not depend on the order the rows arrive in", () => {
      // PostgREST embeds carry no ordering guarantee. Reversing the array must
      // change nothing (DoD §5).
      const versions = [
        version({ id: "v1", version: 1, status: "published" }),
        version({ id: "v2", version: 2, status: "draft" }),
        version({ id: "v3", version: 3, status: "draft" }),
      ];
      const forward = toServiceDetail(row({ service_versions: versions }));
      const reversed = toServiceDetail(row({ service_versions: [...versions].reverse() }));
      expect(reversed.currentVersion).toEqual(forward.currentVersion);
    });

    it("is null when the service has no versions at all", () => {
      expect(toServiceDetail(row()).currentVersion).toBeNull();
    });
  });

  describe("price", () => {
    it("reads the display currency", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ service_version_prices: [{ currency: "UAH", amount_minor: 520000 }] }),
          ],
        }),
      );
      expect(detail.currentVersion?.priceMinor).toBe(520000);
      expect(detail.currentVersion?.currency).toBe("UAH");
    });

    it("reports an unpriced version as null, never as zero", () => {
      // Zero would render as "0.00 UAH" — the card would tell a lawyer the
      // document is free when in fact nobody has priced it yet.
      const detail = toServiceDetail(row({ service_versions: [version()] }));
      expect(detail.currentVersion?.priceMinor).toBeNull();
      expect(detail.currentVersion?.currency).toBeNull();
    });

    it("ignores a price in another currency rather than showing its amount", () => {
      const detail = toServiceDetail(
        row({
          service_versions: [
            version({ service_version_prices: [{ currency: "EUR", amount_minor: 9900 }] }),
          ],
        }),
      );
      expect(detail.currentVersion?.priceMinor).toBeNull();
    });
  });

  describe("who answers for the service", () => {
    const olena = {
      lawyer_id: "usr-olena",
      is_primary: true,
      profiles: { id: "usr-olena", full_name: "Olena Kovalchuk" },
    };
    const taras = {
      lawyer_id: "usr-taras",
      is_primary: false,
      profiles: { id: "usr-taras", full_name: "Taras Bondarenko" },
    };

    it("reports nobody attached as a null primary and an empty cover list", () => {
      const detail = toServiceDetail(row());
      expect(detail.primaryLawyer).toBeNull();
      expect(detail.coverLawyers).toEqual([]);
    });

    it("keeps assigned-but-unreadable apart from unassigned", () => {
      // The profile embed comes back null when RLS hides the row or the account
      // is deactivated. The id is still there, and the card must not claim the
      // service has nobody responsible for it.
      const detail = toServiceDetail(
        row({
          service_assignments: [{ lawyer_id: "usr-hidden", is_primary: true, profiles: null }],
        }),
      );
      expect(detail.primaryLawyer?.id).toBe("usr-hidden");
      expect(detail.primaryLawyer?.fullName).toBeNull();
    });

    it("separates the accountable lawyer from cover", () => {
      const detail = toServiceDetail(row({ service_assignments: [taras, olena] }));
      expect(detail.primaryLawyer?.fullName).toBe("Olena Kovalchuk");
      expect(detail.coverLawyers.map((lawyer) => lawyer.id)).toEqual(["usr-taras"]);
    });

    it("treats cover without an accountable lawyer as nobody accountable", () => {
      // The schema permits it: the partial unique index caps the accountable
      // lawyer at one, it does not require one. Reading the sole cover lawyer
      // as accountable would put a name against an obligation nobody holds.
      const detail = toServiceDetail(row({ service_assignments: [taras] }));
      expect(detail.primaryLawyer).toBeNull();
      expect(detail.coverLawyers.map((lawyer) => lawyer.id)).toEqual(["usr-taras"]);
    });

    it("orders cover by name regardless of the order rows arrive in", () => {
      // Same rule as the versions above, and the same reason (DoD §5): a list
      // that reshuffles between loads reads as a change that did not happen.
      const hidden = { lawyer_id: "usr-hidden", is_primary: false, profiles: null };
      const anna = {
        lawyer_id: "usr-anna",
        is_primary: false,
        profiles: { id: "usr-anna", full_name: "Anna Melnyk" },
      };
      const rows = [hidden, taras, anna, olena];

      const forward = toServiceDetail(row({ service_assignments: rows }));
      const reversed = toServiceDetail(row({ service_assignments: [...rows].reverse() }));

      // Nameless last: it is the exceptional case, and putting it first makes
      // every service that has one look broken.
      expect(forward.coverLawyers.map((lawyer) => lawyer.id)).toEqual([
        "usr-anna",
        "usr-taras",
        "usr-hidden",
      ]);
      expect(reversed.coverLawyers).toEqual(forward.coverLawyers);
    });
  });
});

describe("get", () => {
  // The contract operation itself. This covers the branches the mapping tests
  // cannot reach: a PostgREST error, and the empty result that has to become
  // not_found rather than a null card.

  it("maps a row to the view model", async () => {
    stub.queue = [{ data: row({ title: "Alimony claim" }), error: null }];
    expect((await supabaseServiceDetailApi.get("any")).title).toBe("Alimony claim");
  });

  it("turns an empty result into not_found", async () => {
    // `maybeSingle` returns null with no error when RLS filters the row out.
    // Passing that through as a null card would render "no versions yet"
    // against a service the caller simply may not be allowed to see.
    stub.queue = [{ data: null, error: null }];
    await expect(supabaseServiceDetailApi.get("missing")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("translates a PostgREST error instead of leaking it", async () => {
    stub.queue = [
      { data: null, error: { code: "42501", message: "permission denied", details: "", hint: "" } },
    ];
    await expect(supabaseServiceDetailApi.get("forbidden")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("listAssignableLawyers", () => {
  it("maps rows to the picker's shape", async () => {
    stub.queue = [
      {
        data: [{ id: "usr-olena", full_name: "Olena Kovalchuk", email: "olena@example.test" }],
        error: null,
      },
      { data: null, error: null },
    ];
    const lawyers = await supabaseServiceDetailApi.listAssignableLawyers();
    expect(lawyers).toEqual([
      { id: "usr-olena", fullName: "Olena Kovalchuk", email: "olena@example.test" },
    ]);
  });

  it("asks for lawyers, not for staff", async () => {
    // An admin is readable staff and still may not be made accountable for a
    // service. The distinction lives in the filter, so this is where it is
    // checkable at all.
    stub.queue = [{ data: [], error: null }];
    await supabaseServiceDetailApi.listAssignableLawyers();
    expect(stub.calls).toContainEqual({
      table: "profiles",
      op: "eq",
      args: ["role", "lawyer"],
    });
  });

  it("treats no lawyers as an empty list, not an error", async () => {
    // A firm with no approved lawyers yet is an ordinary early state.
    stub.queue = [{ data: [], error: null }];
    expect(await supabaseServiceDetailApi.listAssignableLawyers()).toEqual([]);
  });

  it("translates a PostgREST error instead of leaking it", async () => {
    stub.queue = [
      { data: null, error: { code: "42501", message: "permission denied", details: "", hint: "" } },
    ];
    await expect(supabaseServiceDetailApi.listAssignableLawyers()).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("setPrimaryLawyer", () => {
  it("goes through the RPC and returns the re-read card", async () => {
    stub.queue = [
      { data: null, error: null },
      { data: row({ title: "Divorce application" }), error: null },
    ];
    const updated = await supabaseServiceDetailApi.setPrimaryLawyer("svc", "usr-taras");

    expect(stub.calls).toContainEqual({
      table: "rpc",
      op: "set_primary_lawyer",
      args: [{ target_service: "svc", new_lawyer: "usr-taras" }],
    });
    expect(updated.title).toBe("Divorce application");
  });

  it("passes null through as null", async () => {
    // The contract's "leave nobody accountable". The generated types cannot
    // express a nullable argument, so this is the only thing standing between
    // the cast in the implementation and a silent change of meaning.
    stub.queue = [
      { data: null, error: null },
      { data: row(), error: null },
    ];
    await supabaseServiceDetailApi.setPrimaryLawyer("svc", null);
    expect(stub.calls).toContainEqual({
      table: "rpc",
      op: "set_primary_lawyer",
      args: [{ target_service: "svc", new_lawyer: null }],
    });
  });

  it("surfaces the function's refusal rather than swallowing it", async () => {
    // The RPC raises for a non-admin, so this denial is loud by construction.
    stub.queue = [
      {
        data: null,
        error: {
          code: "P0001",
          message: "only admins can change who is accountable for a service",
          details: "",
          hint: "",
        },
      },
    ];
    await expect(supabaseServiceDetailApi.setPrimaryLawyer("svc", "usr-taras")).rejects.toThrow(
      /only admins/,
    );
  });
});

describe("addCover", () => {
  it("inserts a non-primary row and returns the re-read card", async () => {
    stub.queue = [
      { data: [{ lawyer_id: "usr-taras" }], error: null },
      { data: row(), error: null },
    ];
    await supabaseServiceDetailApi.addCover("svc", "usr-taras");

    expect(stub.calls).toContainEqual({
      table: "service_assignments",
      op: "insert",
      args: [{ service_id: "svc", lawyer_id: "usr-taras", is_primary: false }],
    });
  });

  it("names the collision instead of reporting a taken value", async () => {
    const duplicate = {
      data: null,
      error: { code: "23505", message: "duplicate key value", details: "", hint: "" },
    };
    // Twice, because each call drains one answer from the queue.
    stub.queue = [duplicate, duplicate];

    await expect(supabaseServiceDetailApi.addCover("svc", "usr-taras")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(supabaseServiceDetailApi.addCover("svc", "usr-taras")).rejects.toThrow(
      /already attached/,
    );
  });

  it("reports a denied insert as forbidden", async () => {
    // INSERT is caught by WITH CHECK, which raises — the loud half of the pair.
    stub.queue = [
      { data: null, error: { code: "42501", message: "permission denied", details: "", hint: "" } },
    ];
    await expect(supabaseServiceDetailApi.addCover("svc", "usr-taras")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("removeCover", () => {
  it("never touches the accountable row", async () => {
    // Expressed as a filter rather than a check, so this assertion on the query
    // is the only place it can be observed. Accountability is moved, not
    // dropped: without this filter a click could leave a service with nobody
    // answering for it.
    stub.queue = [
      { data: [{ lawyer_id: "usr-taras" }], error: null },
      { data: row(), error: null },
    ];
    await supabaseServiceDetailApi.removeCover("svc", "usr-taras");

    expect(stub.calls).toContainEqual({
      table: "service_assignments",
      op: "eq",
      args: ["is_primary", false],
    });
  });

  it("turns a deletion that matched nothing into an error, not a success", async () => {
    // The failure ADR-0012 is written around: an RLS USING clause filters the
    // row out, the DELETE matches nothing, and Postgres reports no error. Left
    // unchecked, the screen would say the lawyer was detached and a reload
    // would show them still there.
    stub.queue = [{ data: [], error: null }];
    await expect(supabaseServiceDetailApi.removeCover("svc", "usr-taras")).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("translates a PostgREST error instead of leaking it", async () => {
    stub.queue = [
      { data: null, error: { code: "42501", message: "permission denied", details: "", hint: "" } },
    ];
    await expect(supabaseServiceDetailApi.removeCover("svc", "usr-taras")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
