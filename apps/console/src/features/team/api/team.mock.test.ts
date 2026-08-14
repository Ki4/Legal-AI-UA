import { afterEach, describe, expect, it } from "vitest";
import { profileRows } from "../../../shared/api/fixture-store";
import { AppError } from "../../../shared/api/errors";
import { mockTeamApi } from "./team.mock";

// The fixture store is module state and `approve` writes to it, so every test
// puts it back. Vitest isolates files from each other; inside a file the order
// is ours to keep honest, and a test that passes only because the one before it
// approved somebody is the failure this repo has already met once in SQL.
const originalProfiles = profileRows.map((row) => ({ ...row }));

afterEach(() => {
  profileRows.length = 0;
  profileRows.push(...originalProfiles.map((row) => ({ ...row })));
});

describe("list", () => {
  it("returns everyone, oldest registration first", async () => {
    const members = await mockTeamApi.list();

    expect(members.map((member) => member.id)).toEqual([
      "usr-admin",
      "usr-olena",
      "usr-taras",
      "usr-pending",
    ]);
  });

  it("marks a member with no role as awaiting approval, and nobody else", async () => {
    const members = await mockTeamApi.list();
    const awaiting = members.filter((member) => member.awaitingApproval);

    expect(awaiting.map((member) => member.id)).toEqual(["usr-pending"]);
    expect(awaiting[0]?.role).toBeNull();
  });

  it("carries the row's own nulls rather than inventing a display name", async () => {
    const members = await mockTeamApi.list();
    const pending = members.find((member) => member.id === "usr-pending");

    // The registration form does not ask for a name, so null is the truthful
    // answer. Substituting the email here would make "has no name" and "is
    // called dmytro@example.test" the same value to every caller.
    expect(pending?.fullName).toBeNull();
    expect(pending?.email).toBe("dmytro@example.test");
  });

  it("hands back ISO timestamps, not Date objects", async () => {
    const [first] = await mockTeamApi.list();

    expect(typeof first?.joinedAt).toBe("string");
    expect(first?.joinedAt).toBe("2026-03-20T09:00:00.000Z");
  });
});

describe("approve", () => {
  it("grants the role and returns the updated member", async () => {
    const updated = await mockTeamApi.approve("usr-pending", "lawyer");

    expect(updated.id).toBe("usr-pending");
    expect(updated.role).toBe("lawyer");
    expect(updated.awaitingApproval).toBe(false);
  });

  it("persists, so the next read agrees with what the mutation returned", async () => {
    await mockTeamApi.approve("usr-pending", "admin");
    const members = await mockTeamApi.list();

    expect(members.find((member) => member.id === "usr-pending")?.role).toBe("admin");
    expect(members.some((member) => member.awaitingApproval)).toBe(false);
  });

  it("rejects a member that does not exist", async () => {
    await expect(mockTeamApi.approve("usr-nobody", "lawyer")).rejects.toBeInstanceOf(AppError);
    await expect(mockTeamApi.approve("usr-nobody", "lawyer")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("refuses to change a role somebody already holds", async () => {
    // The behaviour ADR-0018 gave the RPC, mirrored here. It used to be the
    // opposite assertion, recording that `approve_user` would re-role anybody —
    // which made this operation the role change ADM-33 has not built, reachable
    // from the approval screen by clicking a stale row.
    await expect(mockTeamApi.approve("usr-olena", "admin")).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("stays silent when the role asked for is the one already held", async () => {
    // A double-click is not an attempt to change anything, and an error here
    // would be the only one this screen ever shows.
    const updated = await mockTeamApi.approve("usr-olena", "lawyer");

    expect(updated.role).toBe("lawyer");
  });
});
