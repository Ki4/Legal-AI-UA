// The live implementation. The swap point in index.ts is the only thing that
// knows this file exists.

import { asRole } from "@legal-ai/db";
import { supabase } from "../../../app/supabase";
import { AppError } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { TeamApi } from "./contract";
import type { GrantableRole, TeamMember } from "./types";

const COLUMNS = "id, email, full_name, role, created_at";

/**
 * The row shape this file asks for, written out rather than inferred.
 *
 * `role` is `string | null` and not `Role | null`: the column is plain `text`,
 * so the generated type cannot promise the union and neither can we. Narrowing
 * it is `asRole`'s job, and doing it here is the whole reason a view model
 * exists — the previous hand-written row type simply asserted the union and was
 * believed.
 */
export interface TeamMemberQueryRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

/** Exported for its test: the translation is where the decisions are. */
export function toTeamMember(row: TeamMemberQueryRow): TeamMember {
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

export const supabaseTeamApi: TeamApi = {
  async list() {
    const { data, error } = await supabase
      .from("profiles")
      .select(COLUMNS)
      .order("created_at")
      .returns<TeamMemberQueryRow[]>();

    if (error) throw fromPostgrest(error, "Loading the team");

    return (data ?? []).map(toTeamMember);
  },

  async approve(memberId, role: GrantableRole) {
    const { error } = await supabase.rpc("approve_user", {
      target_user: memberId,
      new_role: role,
    });

    if (error) throw fromPostgrest(error, "Approving the registration");

    // Re-read rather than trust: `approve_user` returns void, and convention 5
    // asks a mutation for the updated entity. It writes to two places —
    // `auth.users.app_metadata`, which is what access control reads, and
    // `public.profiles.role`, which is the display mirror — so this select is
    // also the only confirmation available that the mirror moved with it.
    const { data, error: readError } = await supabase
      .from("profiles")
      .select(COLUMNS)
      .eq("id", memberId)
      .returns<TeamMemberQueryRow[]>();

    if (readError) throw fromPostgrest(readError, "Reading back the approved member");

    const [updated] = data ?? [];

    // Deliberately not `expectOne`. Its message says nothing was written, and
    // here that would be a lie: the RPC is SECURITY DEFINER and returned
    // without raising, so the write happened. An empty result means the row
    // cannot be *read* — a different failure, and one worth naming correctly.
    if (updated === undefined) {
      throw new AppError(
        "not_found",
        "Approving the registration: the role was granted, but the member could not be read back.",
      );
    }

    return toTeamMember(updated);
  },
};
