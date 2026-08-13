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

    // No guard against re-roling somebody who already holds a role, because
    // `approve_user` has none either: it updates `profiles.role` and
    // `app_metadata` unconditionally for any target. So the RPC is already the
    // role-change operation ADM-33 has not built a screen for, without saying
    // so anywhere. Noted rather than fixed here — changing it is a migration,
    // which is Tier 2 and access control both. What a fixture must not do is
    // refuse what the database accepts: a mock stricter than the schema teaches
    // the screen a rule that will not survive contact with Postgres.
    target.role = role;

    return toTeamMember(target);
  },
};
