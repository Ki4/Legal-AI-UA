// Supabase implementation of ServicesApi (ADM-7).
//
// It does the same work the fixture implementation did — read rows, join them,
// produce the view model — which is why swapping index.ts changes no component
// (ADR-0012).
//
// One embed is worth understanding before reading the mapping below. `profiles`
// is behind RLS that lets a lawyer read only their own row, so embedding the
// assigned lawyer returns **null for somebody else's profile** while
// `assigned_lawyer_id` on the service is still set. That is not an error and it
// is not "unassigned": it is "assigned, name unavailable", and `toLawyerRef`
// keeps those two apart. Collapsing them would make the screen state a
// falsehood about who is responsible for a service.

import { supabase } from "../../../app/supabase";
import { AppError, expectOne } from "../../../shared/api/errors";
import { escapeSearchTerm, fromPostgrest } from "../../../shared/api/postgrest";
import type { ServicesApi } from "./contract";
import type { LawyerRef, ServiceListItem, ServiceVersionSummary } from "./types";

/** The currency the catalogue screens display (spec §8). */
const DISPLAY_CURRENCY = "UAH";

const SELECT = `
  id, slug, title, created_at, updated_at, assigned_lawyer_id,
  profiles ( id, full_name ),
  service_versions (
    id, version, status, generation_mode, review_mode,
    service_version_prices ( currency, amount_minor )
  )
` as const;

interface ServiceQueryRow {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
  assigned_lawyer_id: string | null;
  profiles: { id: string; full_name: string | null } | null;
  service_versions: {
    id: string;
    version: number;
    status: ServiceVersionSummary["status"];
    generation_mode: ServiceVersionSummary["generationMode"];
    review_mode: ServiceVersionSummary["reviewMode"];
    service_version_prices: { currency: string; amount_minor: number }[];
  }[];
}

function toLawyerRef(row: ServiceQueryRow): LawyerRef | null {
  if (row.assigned_lawyer_id === null) return null;
  return { id: row.assigned_lawyer_id, fullName: row.profiles?.full_name ?? null };
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
    assignedLawyer: toLawyerRef(row),
    currentVersion: currentVersionOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseServicesApi: ServicesApi = {
  async list(filter) {
    let query = supabase.from("services").select(SELECT).order("updated_at", { ascending: false });

    if (filter?.lawyerId !== undefined) {
      query = query.eq("assigned_lawyer_id", filter.lawyerId);
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

  async assignLawyer(id, lawyerId) {
    const { data, error } = await supabase
      .from("services")
      .update({ assigned_lawyer_id: lawyerId })
      .eq("id", id)
      .select(SELECT)
      .returns<ServiceQueryRow[]>();

    if (error) throw fromPostgrest(error, "Assigning a lawyer");

    // Not a formality. An update denied by an RLS USING clause writes nothing
    // and reports no error — the row count is the only signal that the change
    // did not happen (ADR-0012, convention 3). This is the first place in the
    // repo where that guard is load-bearing rather than exemplary: a lawyer
    // reassigning a service is denied by exactly that clause.
    return toListItem(expectOne(data, "Assigning a lawyer"));
  },
};
