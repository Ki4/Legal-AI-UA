// Supabase implementation of ServiceDetailApi.
//
// The card asks for more than the list row does — the summary, and when the
// current version was published — so it runs its own query rather than reusing
// the list's. That is the shape ADR-0012 asks for: a view model belongs to the
// screen that renders it, and two screens sharing one query drag each other
// along every time either changes.
//
// The mapping below is exported so it can be tested without a database. The
// query is one PostgREST call and needs a running stack to mean anything; the
// row → view model translation is where the decisions live, and it is pure.

import { supabase } from "../../../app/supabase";
import { AppError } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { ServiceDetailApi } from "./contract";
import type { ServiceDetail } from "./types";

/** The currency the catalogue screens display (spec §8). */
const DISPLAY_CURRENCY = "UAH";

const SELECT = `
  id, slug, title, summary, created_at, updated_at,
  service_assignments ( lawyer_id, is_primary, profiles ( id, full_name ) ),
  service_versions (
    id, version, status, generation_mode, review_mode, published_at,
    service_version_prices ( currency, amount_minor )
  )
`;

export interface ServiceDetailQueryRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
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
    status: NonNullable<ServiceDetail["currentVersion"]>["status"];
    generation_mode: NonNullable<ServiceDetail["currentVersion"]>["generationMode"];
    review_mode: NonNullable<ServiceDetail["currentVersion"]>["reviewMode"];
    published_at: string | null;
    service_version_prices: { currency: string; amount_minor: number }[];
  }[];
}

type VersionRow = ServiceDetailQueryRow["service_versions"][number];

/**
 * The version the card reflects: the live one — published or paused — when
 * there is one, otherwise the newest.
 *
 * This repeats the rule `features/services` applies to the list, and the
 * repetition is deliberate: sharing it would mean sharing a row type between
 * two features, which is the coupling ADR-0012 forbids. What must not diverge
 * is the *rule*, so it is stated here in full rather than referred to.
 *
 * The schema allows only one live version per service, but this still compares
 * `version` rather than taking the first match — an embedded PostgREST array
 * arrives in whatever order the planner produced (DoD §5).
 */
function currentVersionOf(row: ServiceDetailQueryRow): ServiceDetail["currentVersion"] {
  const versions = row.service_versions;
  const live = versions.filter((v) => v.status === "published" || v.status === "paused");
  const candidates = live.length > 0 ? live : versions;

  const chosen = candidates.reduce<VersionRow | null>(
    (best, v) => (best === null || v.version > best.version ? v : best),
    null,
  );
  if (chosen === null) return null;

  // A draft may legitimately carry no price in the display currency. Null says
  // "not priced"; zero would say the document is free.
  const price = chosen.service_version_prices.find((p) => p.currency === DISPLAY_CURRENCY) ?? null;

  return {
    version: chosen.version,
    status: chosen.status,
    generationMode: chosen.generation_mode,
    reviewMode: chosen.review_mode,
    priceMinor: price?.amount_minor ?? null,
    currency: price?.currency ?? null,
    publishedAt: chosen.published_at,
  };
}

export function toServiceDetail(row: ServiceDetailQueryRow): ServiceDetail {
  // The accountable lawyer. Cover carries the same rights and none of the
  // obligation (spec §13), and the card answers "who answers for this" — so
  // cover is not surfaced here. The assignment editor is ADM-10.
  const primary = row.service_assignments.find((a) => a.is_primary) ?? null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    assignedLawyerId: primary?.lawyer_id ?? null,
    // Two different nulls, kept apart (DoD §5): nobody assigned, versus
    // assigned to someone whose profile this caller cannot read — a
    // deactivated account, or a row RLS hides. Collapsing them would let the
    // card claim a service has nobody responsible for it when it does.
    assignedLawyerName: primary === null ? null : (primary.profiles?.full_name ?? null),
    currentVersion: currentVersionOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseServiceDetailApi: ServiceDetailApi = {
  async get(id) {
    const { data, error } = await supabase
      .from("services")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle()
      .returns<ServiceDetailQueryRow | null>();

    if (error) throw fromPostgrest(error, "Loading service");
    if (data === null) {
      // Indistinguishable from "exists but RLS hides it", and deliberately so:
      // telling an unauthorised caller that a record exists is itself a leak.
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    return toServiceDetail(data);
  },
};
