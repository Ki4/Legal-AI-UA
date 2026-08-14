// Fixture implementation. Typed as the contract, so drift fails to compile.
//
// It exists after the live implementation landed, not before, for the reason
// ADR-0012 gives: the tests run against it, and it stays the shape any future
// implementation is checked against.

import { asRole } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import { fixtureDelay, profileRows } from "../../../shared/api/fixture-store";
import type { TeamApi } from "./contract";
import type { GrantableRole, TeamMember } from "./types";

function toTeamMember(row: (typeof profileRows)[number]): TeamMember {
  const role = asRole(row.role);

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role,
    joinedAt: row.created_at,
    awaitingApproval: role === null,
  };
}

export const mockTeamApi: TeamApi = {
  async list() {
    await fixtureDelay();

    // Sorted rather than trusted: array order in a fixture store is as
    // meaningless as row order from Postgres without an ORDER BY, and the
    // contract promises oldest first.
    return [...profileRows]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map(toTeamMember);
  },

  async approve(memberId, role: GrantableRole) {
    await fixtureDelay();

    const target = profileRows.find((profile) => profile.id === memberId);

    if (target === undefined) {
      throw new AppError("not_found", "Approving the registration: no such member.");
    }

    // The same refusal `approve_user` makes since ADR-0018: this operation
    // grants a first role and does not change one. Re-approving with the role
    // the member already holds stays silent, because a double-click is not an
    // attempt to change anything.
    //
    // A fixture must match the database in both directions. Softer than the
    // schema teaches the screen a rule Postgres will not honour; stricter
    // teaches it one Postgres does not have. This used to be the first case and
    // would now be the second.
    if (target.role !== null && target.role !== role) {
      throw new AppError(
        "conflict",
        `Approving the registration: ${target.email} already holds a role. Changing one is a separate operation (ADM-33).`,
      );
    }

    target.role = role;

    return toTeamMember(target);
  },
};
