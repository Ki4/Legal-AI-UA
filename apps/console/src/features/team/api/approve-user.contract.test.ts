// The fixture that stands in for an RPC, tied to the RPC it stands in for.
//
// A row-shaped fixture cannot drift: `profileRows` is `ProfileRow[]`, generated
// from the schema by `pnpm db:types`, so a column that changes type breaks the
// build in the fixture's own file. `team.mock.ts` has no such anchor — it
// simulates `approve_user` in TypeScript, and the function it simulates lives in
// SQL. A migration renaming an argument would leave the mock happily simulating
// a call that no longer exists, and `team.mock.test.ts` would stay green,
// because it asserts against the mock rather than against the schema.
//
// So the anchor is made explicitly. Everything below is a *type* assertion: it
// costs nothing at runtime, and it fails at `pnpm typecheck` the moment
// `db:types` is regenerated over a changed function.
//
// What this cannot check, stated so a green build is not read as more: whether
// the mock's *behaviour* still matches the function's. That `approve_user`
// raises when re-roling somebody is asserted twice, in two places that do not
// know about each other — `verify_approve_user.sql` against Postgres, and
// `team.mock.test.ts` against the fixture. Keeping those two in step is a
// person's job.

import type { DbFunctionArgs, DbFunctionReturns } from "@legal-ai/db";
import { describe, expect, it } from "vitest";
import type { GrantableRole } from "./types";

type ApproveArgs = DbFunctionArgs<"approve_user">;

/** Compile-time equality: distributes nothing, so `A | B` never satisfies `A`. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Passes its argument through, which is the point: the *type* argument is the
 * assertion, and the value argument exists so that neither it nor `T` is unused.
 * A version that ignored both would need the lint rule silenced here — and that
 * rule earns its keep on the real code, so it is not worth spending.
 */
function assertType<T extends true>(value: T): T {
  return value;
}

describe("approve_user, as the mock believes it to be", () => {
  it("takes exactly the two arguments the implementation sends", () => {
    // `team.supabase.ts` calls `.rpc("approve_user", { target_user, new_role })`.
    // A renamed or added argument lands here first.
    expect(assertType<Exact<keyof ApproveArgs, "target_user" | "new_role">>(true)).toBe(true);
  });

  it("takes the member id as a string, which is what the contract passes", () => {
    expect(assertType<Exact<ApproveArgs["target_user"], string>>(true)).toBe(true);
  });

  it("accepts every role the console is allowed to grant", () => {
    // The direction that matters: `GrantableRole` must be assignable to what the
    // function takes. If the schema narrowed `new_role` to an enum that dropped
    // one of them, this stops compiling — and `ADM-33` would otherwise find out
    // in production.
    expect(assertType<GrantableRole extends ApproveArgs["new_role"] ? true : false>(true)).toBe(
      true,
    );
  });

  it("returns nothing, which is why the implementation reads the row back", () => {
    // Convention 5 asks a mutation for the updated entity. This is the line that
    // records *why* `approve` costs two round trips — and that would break if the
    // function ever started returning the profile, at which point the second
    // trip should be deleted rather than left as cargo.
    expect(assertType<Exact<DbFunctionReturns<"approve_user">, undefined>>(true)).toBe(true);
  });
});
