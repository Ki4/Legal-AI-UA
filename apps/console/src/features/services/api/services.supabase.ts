// Supabase implementation of ServicesApi (ADM-7).
//
// It does the same work the fixture implementation did — read rows, join them,
// produce the view model — which is why swapping index.ts changes no component
// (ADR-0012).
//
// One embed is worth understanding before reading the mapping below. Staff can
// read approved colleagues' names, but a profile can still come back null — a
// deactivated account, or a row RLS hides. `assigned_lawyer_id` being set with
// no readable profile means "assigned, name unavailable", which is not the same
// statement as "nobody assigned", and `toLawyerRef` keeps them apart. Collapsing
// them would make the screen lie about who is responsible for a service.

import { supabase } from "../../../app/supabase";
import { AppError } from "../../../shared/api/errors";
import { escapeSearchTerm, fromPostgrest } from "../../../shared/api/postgrest";
import type { ServicesApi } from "./contract";
import type { LawyerRef, ServiceListItem, ServiceVersionSummary } from "./types";

/** The currency the catalogue screens display (spec §8). */
const DISPLAY_CURRENCY = "UAH";

function selectFor({ innerJoinAssignments = false } = {}): string {
  // `!inner` turns the embed from a decoration into a join condition. It is
  // conditional because the plain form is what the list needs: a service with
  // nobody assigned must still appear, and an inner join would silently drop it.
  const assignments = innerJoinAssignments ? "service_assignments!inner" : "service_assignments";

  return `
    id, slug, title, created_at, updated_at,
    ${assignments} ( lawyer_id, is_primary, profiles ( id, full_name ) ),
    service_versions (
      id, version, status, generation_mode, review_mode,
      service_version_prices ( currency, amount_minor )
    )
  `;
}

const SELECT = selectFor();

interface ServiceQueryRow {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
  service_assignments: {
    lawyer_id: string;
    is_primary: boolean;
    profiles: { id: string; full_name: string | null } | null;
  }[];
  service_versions: {
    id: string;
    version: number;
    status: ServiceVersionSummary["status"];
    generation_mode: ServiceVersionSummary["generationMode"];
    review_mode: ServiceVersionSummary["reviewMode"];
    service_version_prices: { currency: string; amount_minor: number }[];
  }[];
}

type AssignmentRow = ServiceQueryRow["service_assignments"][number];

function toLawyerRef(assignment: AssignmentRow): LawyerRef {
  return { id: assignment.lawyer_id, fullName: assignment.profiles?.full_name ?? null };
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
    primaryLawyer: row.service_assignments.filter((a) => a.is_primary).map(toLawyerRef)[0] ?? null,
    coverLawyers: row.service_assignments.filter((a) => !a.is_primary).map(toLawyerRef),
    currentVersion: currentVersionOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseServicesApi: ServicesApi = {
  async list(filter) {
    const byLawyer = filter?.lawyerId !== undefined;

    let query = supabase
      .from("services")
      .select(selectFor({ innerJoinAssignments: byLawyer }))
      .order("updated_at", { ascending: false });

    if (filter?.lawyerId !== undefined) {
      // Matches a lawyer in either role — accountable or cover — because the
      // filter is on the assignment row, not on a column of the service.
      query = query.eq("service_assignments.lawyer_id", filter.lawyerId);
    }

    if (filter?.query !== undefined && filter.query.trim() !== "") {
      const term = escapeSearchTerm(filter.query);
      if (term !== "") {
        query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
      }
    }

    const { data, error } = await query.returns<ServiceQueryRow[]>();
    if (error) throw fromPostgrest(error, "Loading services");

    const items = data.map(toListItem);

    // Status is a property of the *current* version, which is chosen in
    // JavaScript above — so it cannot be a WHERE clause without a view that
    // resolves the live version in SQL. Filtering here keeps one definition of
    // "current" instead of two that will disagree. Revisit if the catalogue
    // ever outgrows a single page; at a few dozen services it is not a cost.
    const wanted = filter?.status;
    if (wanted === undefined || wanted.length === 0) return items;

    return items.filter((item) => {
      const status = item.currentVersion?.status;
      return status !== undefined && wanted.includes(status);
    });
  },

  async get(id) {
    const { data, error } = await supabase
      .from("services")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle()
      .returns<ServiceQueryRow | null>();

    if (error) throw fromPostgrest(error, "Loading service");
    if (data === null) {
      // Indistinguishable from "exists but RLS hides it", and deliberately so:
      // telling an unauthorised caller that a record exists is itself a leak.
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    return toListItem(data);
  },

  async setPrimaryLawyer(id, lawyerId) {
    // An RPC rather than two writes: clearing the old primary and setting the
    // new one are one decision, and a browser interrupted between them leaves a
    // service with nobody accountable. The function checks the admin role
    // itself, so a denial arrives as an error rather than as silence.
    const { error } = await supabase.rpc("set_primary_lawyer", {
      target_service: id,
      // `supabase gen types` cannot express argument nullability, so it types
      // this as string. Postgres accepts null for a uuid argument, and the
      // function treats it as "leave nobody accountable" — which is the whole
      // reason the contract allows null.
      new_lawyer: lawyerId as string,
    });
    if (error) throw fromPostgrest(error, "Changing the accountable lawyer");

    return this.get(id);
  },
};
