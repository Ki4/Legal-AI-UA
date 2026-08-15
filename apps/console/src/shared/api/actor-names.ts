// The other half of `shared/audit.ts`: the part that asks Postgres for names.
//
// It is a separate module because the pure half is imported by fixture
// implementations, and `app/supabase` builds its client at import time and
// throws when the env vars are absent — which they are under Vitest. Keeping
// the query here means a `*.mock.ts` can share the rules without dragging a
// database client into a unit test.

import type { ProfileRow } from "@legal-ai/db";
import { supabase } from "../../app/supabase";
import type { ActorNames } from "../audit";

/**
 * The names, fetched separately rather than embedded.
 *
 * `audit_events` has no foreign keys on purpose (ADR-0010 — evidence a cascade
 * can reshape is not evidence), so there is no relationship for PostgREST to
 * embed a profile through. This is what the api layer is for.
 */
export async function namesOf(ids: readonly string[]): Promise<ActorNames> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);

  // Deliberately not fatal. A history whose actors are anonymous is worth
  // reading; a history that refuses to render because a name lookup failed is
  // not. The rows that came back are used and the rest fall through to
  // `unnamed`, which is a state every caller already has to render.
  if (error) return new Map();

  const names = new Map<string, string>();
  for (const row of (data ?? []) as Pick<ProfileRow, "id" | "full_name">[]) {
    if (row.full_name !== null) names.set(row.id, row.full_name);
  }
  return names;
}
