// View models for the team screen (ADR-0012, conventions 1 and 6).
//
// A `profiles` row is closer to what this screen renders than most — which is
// exactly when a view model looks skippable and is most worth keeping. Three
// things differ, and all three are decisions rather than formatting: `role` is
// plain `text` in Postgres and a union here, `created_at` is a timestamp there
// and an ISO string across this boundary (convention 2), and "awaiting
// approval" is a rule rather than a column.

import type { Role } from "@legal-ai/db";

/**
 * The roles an admin may grant from this screen.
 *
 * Deliberately its own type rather than `Role`, even though the two sets are
 * identical today. `approve_user` accepts exactly these two and raises on
 * anything else; a third role added to the domain vocabulary tomorrow would
 * otherwise become grantable here by inheritance, without anybody deciding it
 * should be.
 */
export type GrantableRole = Extract<Role, "admin" | "lawyer">;

export interface TeamMember {
  id: string;
  email: string;
  /** Null until the person fills it in — the registration form does not ask. */
  fullName: string | null;
  /** Null means not approved yet, never "no permissions decided". */
  role: Role | null;
  /** ISO 8601 (convention 2), the moment the profile row appeared. */
  joinedAt: string;
  /**
   * A registration nobody has approved yet.
   *
   * Derived from `role === null` here rather than in the component, because it
   * is a rule the auth migration encodes: a profile exists from the moment
   * somebody registers, and the role is what approval writes. A component
   * testing `role === null` would be holding a piece of the access model in a
   * template, where the next screen to need it copies rather than imports it.
   */
  awaitingApproval: boolean;
}
