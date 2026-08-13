// The contract for the team screen (ADR-0012).
//
// `team` was the last feature reading Supabase from inside a component, and the
// most valuable one to convert: it is the only one with a mutation that changes
// what a person is allowed to do. Everything it needs from the database is
// named here, so the screen can be read without knowing there is a database.

import type { GrantableRole, TeamMember } from "./types";

export interface TeamApi {
  /**
   * Everyone with a profile, oldest registration first.
   *
   * Oldest first rather than newest, because the list is a queue: the person
   * who has been waiting longest for approval is the one to deal with, and
   * putting them at the bottom is how a registration gets forgotten.
   *
   * What comes back depends on who is asking — `profiles` carries three select
   * policies, and an admin sees rows a lawyer does not. That is the database's
   * decision, not this layer's: the layer never filters for permission, it
   * reports what the caller was allowed to read.
   */
  list(): Promise<TeamMember[]>;

  /**
   * Grant a role to a member.
   *
   * Named for what the screen does — approve a pending registration — but the
   * underlying RPC does not check that the target has no role, so this also
   * *changes* one. Only pending members are offered it today; the day ADM-33
   * builds role changes, it will find the operation already here.
   *
   * Returns the updated member (convention 5), so the caller re-renders one row
   * instead of reloading the screen.
   *
   * Throws `AppError` when the caller is not an admin — `approve_user` is
   * `SECURITY DEFINER` and raises rather than silently doing nothing, so this
   * denial is in the loud half. It is not the `USING`-clause case convention 3
   * guards against, and the implementation says so where it would otherwise
   * look like a missing `expectOne`.
   */
  approve(memberId: string, role: GrantableRole): Promise<TeamMember>;
}
