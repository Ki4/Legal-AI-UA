// Who acted, resolved from an audit row — shared, because two screens now read
// the same log and would otherwise hold two answers to the same question.
//
// `apps/console/CLAUDE.md` gives the rule and its reason: a feature never
// imports from a sibling, so anything two features need lives in `packages/*`
// or here. The service history (§4.8) reads `audit_events` by service; the
// order card (§4.16) reads it by order. The rows are identical and so is the
// hardest part of reading them, which is not the query.
//
// **Nothing here may reach `app/supabase`.** A fixture implementation imports
// this, and that module builds its client at import time and throws without env
// vars — so a single import would take every `*.mock.ts` test down with it. The
// half that talks to Postgres is `shared/api/actor-names.ts`, and the split is
// this rule made structural rather than remembered.

/**
 * The three states the log can actually produce, and they are one field rather
 * than a nullable name because collapsing them says something false (DoD §5).
 *
 * - `person` — the actor's profile was readable, so there is a name.
 * - `unnamed` — somebody acted and their profile is not readable: a deactivated
 *   account, or a row RLS hides from this reader. Distinct from `system`,
 *   because a person did this.
 * - `system` — no actor at all. `auth.uid()` is null outside a request, so a
 *   migration, a seed or a scheduled job lands here rather than being
 *   attributed to whoever happened to deploy.
 */
export type AuditActor =
  | { kind: "person"; id: string; fullName: string; roleAtTheTime: string | null }
  | { kind: "unnamed"; id: string; roleAtTheTime: string | null }
  | { kind: "system"; roleAtTheTime: string | null };

/**
 * Names for the actors on a page of events, by id.
 *
 * Absent from the map means no name is available — either the profile is hidden
 * from this reader by `profiles_select_staff`, or the row exists and its
 * `full_name` is null, which the column allows. Those two are collapsed
 * deliberately: they differ in cause and not in anything the reader can do.
 * What must not collapse is either of them into "nobody acted", and that
 * distinction is made in `actorFrom` from the id alone, before this map is
 * consulted.
 */
export type ActorNames = ReadonlyMap<string, string>;

export function actorFrom(
  row: { actor_id: string | null; actor_role: string | null },
  names: ActorNames,
): AuditActor {
  if (row.actor_id === null) return { kind: "system", roleAtTheTime: row.actor_role };

  const fullName = names.get(row.actor_id);
  if (fullName === undefined) {
    return { kind: "unnamed", id: row.actor_id, roleAtTheTime: row.actor_role };
  }

  return { kind: "person", id: row.actor_id, fullName, roleAtTheTime: row.actor_role };
}

/** The distinct, non-null actor ids on a page of rows. */
export function actorIdsOf(rows: readonly { actor_id: string | null }[]): string[] {
  return [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => id !== null))];
}
