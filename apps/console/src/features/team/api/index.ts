// The swap point. `team` was already reading Postgres — badly, from inside a
// component — so this lands pointed at the live implementation rather than at
// fixtures: routing it through the mock first would be a regression dressed as
// a migration.

import type { TeamApi } from "./contract";
import { supabaseTeamApi } from "./team.supabase";

export const teamApi: TeamApi = supabaseTeamApi;

export type { TeamApi } from "./contract";
export type { GrantableRole, TeamMember } from "./types";
