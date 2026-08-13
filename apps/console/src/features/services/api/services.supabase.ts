// Supabase implementation of ServicesApi (ADM-7, ADM-61).
//
// It does the same work the fixture implementation did — read rows, join them,
// produce the view model — which is why swapping index.ts changes no component
// (ADR-0012).
//
// One embed is worth understanding before reading the mapping below. Staff can
// read approved colleagues' names, but a profile can still come back null — a
// deactivated account, or a row RLS hides. An assignment row with no readable
// profile means "assigned, name unavailable", which is not the same statement
// as "nobody assigned", and `toLawyerRef` keeps them apart. Collapsing them
// would make the screen lie about who is responsible for a service.
//
// Where the filtering happens is the other thing to understand, and it is
// deliberate rather than lazy — see `browse`.

import type { QueryData } from "@supabase/supabase-js";
import { supabase } from "../../../app/supabase";
import { AppError } from "../../../shared/api/errors";
import { escapeSearchTerm, fromPostgrest } from "../../../shared/api/postgrest";
import type { ServicesApi } from "./contract";
import { facetAndFilter } from "./facets";
import type { LawyerRef, PracticeAreaRef, ServiceListItem, ServiceVersionSummary } from "./types";

/** The currency the catalogue screens display (spec §8). */
const DISPLAY_CURRENCY = "UAH";

// Two literals rather than one string composed at runtime. `QueryData` (below)
// can only infer a row shape from a `select()` argument that is a literal
// known at compile time — the dynamically built string this replaced defeated
// that inference entirely, which is what let `label_uk` be dropped from a
// select and still compile (the defect this file was rewritten to close).
//
// `!inner` turns the `service_assignments` embed from a decoration into a join
// condition. SELECT_INNER_JOIN_ASSIGNMENTS is used only when filtering by
// lawyer (`browse({ lawyerId })`); SELECT_BASE is what an unfiltered list
// needs instead — a service with nobody assigned must still appear, and an
// inner join would silently drop it.
const SELECT_BASE = `
  id, slug, title, summary, practice_area, created_at, updated_at,
  practice_areas ( code, label_uk, label_en, position ),
  service_assignments ( lawyer_id, is_primary, profiles ( id, full_name ) ),
  service_versions (
    id, version, status, generation_mode, review_mode,
    service_version_prices ( currency, amount_minor )
  )
` as const;

const SELECT_INNER_JOIN_ASSIGNMENTS = `
  id, slug, title, summary, practice_area, created_at, updated_at,
  practice_areas ( code, label_uk, label_en, position ),
  service_assignments!inner ( lawyer_id, is_primary, profiles ( id, full_name ) ),
  service_versions (
    id, version, status, generation_mode, review_mode,
    service_version_prices ( currency, amount_minor )
  )
` as const;

// The query `get()` and the no-lawyer branch of `browse()` actually run —
// named so its return type can be read off with `ReturnType`, rather than
// building a second, never-awaited query solely to have something to take
// `typeof` of. A row from SELECT_INNER_JOIN_ASSIGNMENTS is structurally the
// same: `!inner` changes which rows Postgres returns, not the shape of one.
function baseQuery() {
  return supabase.from("services").select(SELECT_BASE);
}

type InferredServiceRow = QueryData<ReturnType<typeof baseQuery>>[number];
type InferredAssignment = InferredServiceRow["service_assignments"][number];

/**
 * One field the inference above gets wrong, and the reason this type is not
 * simply `InferredServiceRow`. `service_assignments.lawyer_id` is a NOT NULL
 * foreign key, so the compiler infers the embedded `profiles` as always
 * present. It is not: RLS can still hide the referenced row — a deactivated
 * account, or a colleague this caller cannot read — and PostgREST returns
 * `profiles: null` when it does. The compiler is checking that every column
 * named in `SELECT_BASE` exists on `profiles`; it has no way to check whether
 * a policy will let the row through, so that half stays hand-asserted here,
 * derived from the inferred shape rather than restating it. `toLawyerRef` is
 * what turns the null into "assigned, name unavailable" instead of losing it.
 */
type ServiceQueryRow = Omit<InferredServiceRow, "service_assignments"> & {
  service_assignments: (Omit<InferredAssignment, "profiles"> & {
    profiles: NonNullable<InferredAssignment["profiles"]> | null;
  })[];
};

type AssignmentRow = ServiceQueryRow["service_assignments"][number];

function toLawyerRef(assignment: AssignmentRow): LawyerRef {
  return { id: assignment.lawyer_id, fullName: assignment.profiles?.full_name ?? null };
}

/**
 * The column is `not null` and the embed should always resolve. Should is not a
 * guarantee a screen can be built on: an unresolved embed would otherwise take
 * the whole catalogue down, and a total mapping renders the raw code instead —
 * visibly odd, which is what bad data should look like (DoD §5). Sorting it
 * last keeps an oddity from leading the page.
 */
function toPracticeAreaRef(row: ServiceQueryRow): PracticeAreaRef {
  const area = row.practice_areas;
  if (area === null) {
    // The code in every language: it is not a label in any of them, and
    // pretending otherwise would hide the unresolved embed in whichever
    // language the reader happens to be using.
    return {
      code: row.practice_area,
      labels: { uk: row.practice_area, en: row.practice_area },
      position: Number.MAX_SAFE_INTEGER,
    };
  }
  return {
    code: area.code,
    labels: { uk: area.label_uk, en: area.label_en },
    position: area.position,
  };
}

/**
 * The version a catalogue screen reflects: the live one — published or paused —
 * when there is one, otherwise the newest.
 *
 * The schema guarantees a single live version per service, but this still picks
 * the highest rather than the first: an embedded PostgREST array arrives in
 * whatever order the planner produced, and "the first live row" would be
 * correct only by luck.
 */
function currentVersionOf(row: ServiceQueryRow): ServiceVersionSummary | null {
  const versions = row.service_versions;
  const live = versions.filter((v) => v.status === "published" || v.status === "paused");
  const candidates = live.length > 0 ? live : versions;

  const chosen = candidates.reduce<(typeof versions)[number] | null>(
    (best, v) => (best === null || v.version > best.version ? v : best),
    null,
  );
  if (chosen === null) return null;

  // A version may legitimately have no price in the display currency — an
  // unpriced draft. Null says so; zero would say the document is free.
  const price = chosen.service_version_prices.find((p) => p.currency === DISPLAY_CURRENCY) ?? null;

  return {
    version: chosen.version,
    status: chosen.status,
    generationMode: chosen.generation_mode,
    reviewMode: chosen.review_mode,
    priceMinor: price?.amount_minor ?? null,
    currency: price?.currency ?? null,
  };
}

function toListItem(row: ServiceQueryRow): ServiceListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    practiceArea: toPracticeAreaRef(row),
    primaryLawyer: row.service_assignments.filter((a) => a.is_primary).map(toLawyerRef)[0] ?? null,
    coverLawyers: row.service_assignments.filter((a) => !a.is_primary).map(toLawyerRef),
    currentVersion: currentVersionOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseServicesApi: ServicesApi = {
  async browse(filter) {
    const lawyerId = filter?.lawyerId;

    // The two branches select different literals (SELECT_BASE vs
    // SELECT_INNER_JOIN_ASSIGNMENTS), which is what keeps `!inner` applying
    // only when filtering by lawyer. Each branch is built and chained in
    // full rather than assigned to one reassignable `let`, because a select
    // string decided at runtime is exactly what defeats `QueryData` (see the
    // comment above the two literals).
    let query =
      lawyerId !== undefined
        ? supabase
            .from("services")
            .select(SELECT_INNER_JOIN_ASSIGNMENTS)
            .order("updated_at", { ascending: false })
            // Matches a lawyer in either role — accountable or cover —
            // because the filter is on the assignment row, not on a column
            // of the service.
            .eq("service_assignments.lawyer_id", lawyerId)
        : baseQuery().order("updated_at", { ascending: false });

    if (filter?.query !== undefined && filter.query.trim() !== "") {
      const term = escapeSearchTerm(filter.query);
      if (term !== "") {
        query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%,summary.ilike.%${term}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw fromPostgrest(error, "Loading services");

    // Area and status are counted and applied here rather than in the WHERE
    // clause, and the two have the same reason underneath.
    //
    // Status is a property of the *current* version, which is chosen in
    // JavaScript above — so it cannot be a WHERE clause without a view that
    // resolves the live version in SQL, and two definitions of "current" would
    // eventually disagree. The area could be filtered in SQL, but then the
    // counts could not: a chip has to say how many services it would show,
    // which is a count over the set with that filter *not* applied. One query
    // that fetches the search-and-lawyer set and narrows it here gives honest
    // counts for both, and §4.1 records the ceiling — a few hundred services,
    // after which this becomes an RPC that aggregates in Postgres.
    return facetAndFilter(data.map(toListItem), filter);
  },

  async get(id) {
    const { data, error } = await baseQuery().eq("id", id).maybeSingle();

    if (error) throw fromPostgrest(error, "Loading service");
    if (data === null) {
      // Indistinguishable from "exists but RLS hides it", and deliberately so:
      // telling an unauthorised caller that a record exists is itself a leak.
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    return toListItem(data);
  },
};
