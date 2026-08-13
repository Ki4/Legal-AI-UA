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

import type { QueryData } from "@supabase/supabase-js";
import { supabase } from "../../../app/supabase";
import { AppError, expectOne } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { ServiceDetailApi } from "./contract";
import type { AssignableLawyer, LawyerRef, ServiceDetail } from "./types";

/** The currency the catalogue screens display (spec §8). */
const DISPLAY_CURRENCY = "UAH";

// `as const` is what lets `QueryData` below infer a row shape from this
// string: inference only works when the argument to `select()` is a literal
// known at compile time.
const SELECT = `
  id, slug, title, summary, created_at, updated_at,
  service_assignments ( lawyer_id, is_primary, profiles ( id, full_name ) ),
  service_versions (
    id, version, status, generation_mode, review_mode, published_at,
    service_version_prices ( currency, amount_minor )
  )
` as const;

// The query `get()` actually runs — named so its return type can be read off
// with `ReturnType`, rather than building a second, never-awaited query
// solely to have something to take `typeof` of. `status`, `generation_mode`
// and `review_mode` come back typed as the generated Postgres enums
// (`Database["public"]["Enums"]`), which is exactly the union
// `ServiceDetail["currentVersion"]` needs — so there is nothing for a
// hand-written override to narrow there.
function detailQuery() {
  return supabase.from("services").select(SELECT);
}

type InferredServiceDetailRow = QueryData<ReturnType<typeof detailQuery>>[number];
type InferredAssignment = InferredServiceDetailRow["service_assignments"][number];

/**
 * One field the inference above gets wrong, and the reason this type is not
 * simply `InferredServiceDetailRow`. `service_assignments.lawyer_id` is a NOT
 * NULL foreign key, so the compiler infers the embedded `profiles` as always
 * present. It is not: RLS can still hide the referenced row — a deactivated
 * account, or a colleague this caller cannot read — and PostgREST returns
 * `profiles: null` when it does. The compiler is checking that every column
 * named in SELECT exists on `profiles`; it has no way to check whether a
 * policy will let the row through, so that half stays hand-asserted here,
 * derived from the inferred shape rather than restating it. `toLawyerRef` is
 * what turns the null into "assigned, name unavailable" instead of losing it.
 */
export type ServiceDetailQueryRow = Omit<InferredServiceDetailRow, "service_assignments"> & {
  service_assignments: (Omit<InferredAssignment, "profiles"> & {
    profiles: NonNullable<InferredAssignment["profiles"]> | null;
  })[];
};

type VersionRow = ServiceDetailQueryRow["service_versions"][number];
type AssignmentRow = ServiceDetailQueryRow["service_assignments"][number];

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

/**
 * Two different nulls, kept apart (DoD §5): nobody attached, versus attached to
 * someone whose profile this caller cannot read — a deactivated account, or a
 * row RLS hides. Collapsing them would let the card claim a service has nobody
 * responsible for it when it does.
 */
function toLawyerRef(assignment: AssignmentRow): LawyerRef {
  return { id: assignment.lawyer_id, fullName: assignment.profiles?.full_name ?? null };
}

export function toServiceDetail(row: ServiceDetailQueryRow): ServiceDetail {
  const primary = row.service_assignments.find((a) => a.is_primary) ?? null;

  // Sorted, because PostgREST embeds arrive in whatever order the planner
  // produced and a list that reshuffles between loads reads as a change that
  // did not happen. Nameless rows sort last rather than first: they are the
  // exceptional case, and putting them at the top makes every service with one
  // look broken.
  const cover = row.service_assignments
    .filter((a) => !a.is_primary)
    .map(toLawyerRef)
    .sort((a, b) => {
      if (a.fullName === null) return b.fullName === null ? a.id.localeCompare(b.id) : 1;
      if (b.fullName === null) return -1;
      return a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
    });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    primaryLawyer: primary === null ? null : toLawyerRef(primary),
    coverLawyers: cover,
    currentVersion: currentVersionOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const supabaseServiceDetailApi: ServiceDetailApi = {
  async get(id) {
    const { data, error } = await detailQuery().eq("id", id).maybeSingle();

    if (error) throw fromPostgrest(error, "Loading service");
    if (data === null) {
      // Indistinguishable from "exists but RLS hides it", and deliberately so:
      // telling an unauthorised caller that a record exists is itself a leak.
      throw new AppError("not_found", `No service with id ${id}.`);
    }

    return toServiceDetail(data);
  },

  async listAssignableLawyers() {
    // `profiles_select_staff` already hides pending registrations from
    // everyone; filtering on the role again here is not that check repeated but
    // a different one — an admin is staff and readable, and still may not be
    // made accountable for a service.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "lawyer")
      .order("full_name", { nullsFirst: false });

    if (error) throw fromPostgrest(error, "Loading lawyers");

    return (data ?? []).map((row): AssignableLawyer => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
    }));
  },

  async setPrimaryLawyer(id, lawyerId) {
    // An RPC rather than two writes: clearing the old holder and setting the
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

  async addCover(id, lawyerId) {
    // INSERT is checked by WITH CHECK, which raises — so a denial here is loud
    // (42501) and arrives as an error. DELETE below is the quiet one.
    const { data, error } = await supabase
      .from("service_assignments")
      .insert({ service_id: id, lawyer_id: lawyerId, is_primary: false })
      .select("lawyer_id");

    if (error?.code === "23505") {
      // The primary key is (service_id, lawyer_id), so this is the only way to
      // collide — and the generic "that value is already taken" would leave the
      // reader guessing which value.
      throw new AppError(
        "conflict",
        "That lawyer is already attached to this service, as cover or as the accountable lawyer.",
        { cause: error },
      );
    }
    if (error) throw fromPostgrest(error, "Adding cover");

    expectOne(data ?? [], "Adding cover");
    return this.get(id);
  },

  async removeCover(id, lawyerId) {
    // The quiet path, and the reason `expectOne` exists: a DELETE denied by an
    // RLS USING clause matches no rows and reports no error, so without the
    // check below the screen would report success and show the lawyer still
    // attached after a reload.
    //
    // `is_primary = false` is a filter rather than a check afterwards: the
    // accountable lawyer is moved, never dropped, and a filter cannot be raced
    // the way a read-then-write can.
    const { data, error } = await supabase
      .from("service_assignments")
      .delete()
      .eq("service_id", id)
      .eq("lawyer_id", lawyerId)
      .eq("is_primary", false)
      .select("lawyer_id");

    if (error) throw fromPostgrest(error, "Removing cover");

    expectOne(data ?? [], "Removing cover");
    return this.get(id);
  },
};
