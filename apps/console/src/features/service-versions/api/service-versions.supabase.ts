// Supabase implementation of ServiceVersionsApi.
//
// Flat queries rather than one embed. The page joins five tables and a name
// lookup, and `service_pauses` points at `service_versions` twice
// (`service_version_id` and `replaced_by`), which is exactly the case where
// PostgREST asks for a disambiguated embed and the inferred row type stops
// being readable. Five small selects and the pure mapper in `mapping.ts` are
// easier to hold in the head, and the mapper is what the tests run against.
//
// Every write is followed by a reload of the page rather than a patch of one
// row: a sale archives the predecessor and closes its pause, a lift flips the
// version's status by trigger — the row this caller touched is never the only
// row that changed (ADR-0012, convention 5, applied to a page).

import type {
  PracticeAreaRow,
  PracticeAreaSignatoryRow,
  ServiceAssignmentRow,
  ServicePauseRow,
  ServiceVersionPriceRow,
  ServiceVersionRow,
} from "@legal-ai/db";
import { supabase } from "../../../app/supabase";
import { namesOf } from "../../../shared/api/actor-names";
import { AppError, expectOne } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { ServiceVersionsApi } from "./contract";
import { staffIdsOf, toPracticeAreaRef, toSignatories, toVersionItems } from "./mapping";
import type { ServiceVersionsPage } from "./types";

async function loadPage(serviceId: string): Promise<ServiceVersionsPage> {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select(
      "id, title, practice_area, practice_areas ( code, label_uk, label_en, position, is_active, created_at )",
    )
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError) throw fromPostgrest(serviceError, "Loading service");
  if (service === null) {
    // Indistinguishable from "exists but RLS hides it", and deliberately so.
    throw new AppError("not_found", `No service with id ${serviceId}.`);
  }

  const { data: versionRows, error: versionsError } = await supabase
    .from("service_versions")
    .select("*")
    .eq("service_id", serviceId);
  if (versionsError) throw fromPostgrest(versionsError, "Loading versions");
  const versions = (versionRows ?? []) as ServiceVersionRow[];
  const versionIds = versions.map((row) => row.id);

  const [pausesResult, pricesResult, signatoriesResult, assignmentsResult] = await Promise.all([
    versionIds.length === 0
      ? Promise.resolve({ data: [] as ServicePauseRow[], error: null })
      : supabase.from("service_pauses").select("*").in("service_version_id", versionIds),
    versionIds.length === 0
      ? Promise.resolve({ data: [] as ServiceVersionPriceRow[], error: null })
      : supabase.from("service_version_prices").select("*").in("service_version_id", versionIds),
    supabase
      .from("practice_area_signatories")
      .select("*")
      .eq("practice_area", service.practice_area),
    supabase
      .from("service_assignments")
      .select("lawyer_id, is_primary")
      .eq("service_id", serviceId),
  ]);

  if (pausesResult.error) throw fromPostgrest(pausesResult.error, "Loading pauses");
  if (pricesResult.error) throw fromPostgrest(pricesResult.error, "Loading prices");
  if (signatoriesResult.error) throw fromPostgrest(signatoriesResult.error, "Loading signatories");
  if (assignmentsResult.error) throw fromPostgrest(assignmentsResult.error, "Loading assignments");

  const pauses = (pausesResult.data ?? []) as ServicePauseRow[];
  const prices = (pricesResult.data ?? []) as ServiceVersionPriceRow[];
  const signatories = (signatoriesResult.data ?? []) as PracticeAreaSignatoryRow[];
  const assignments = (assignmentsResult.data ?? []) as Pick<
    ServiceAssignmentRow,
    "lawyer_id" | "is_primary"
  >[];

  const names = await namesOf(staffIdsOf(versions, pauses, signatories));

  return {
    service: {
      id: service.id,
      title: service.title,
      // The embed is typed as present because `practice_area` is NOT NULL, and
      // can still be null when the reference row is hidden — the same hand
      // assertion `features/services` makes.
      practiceArea: toPracticeAreaRef((service.practice_areas as PracticeAreaRow | null) ?? null),
      practiceAreaCode: service.practice_area,
    },
    versions: toVersionItems({ versions, pauses, prices, names }),
    signatories: toSignatories(signatories, names),
    assignments: assignments.map((row) => ({ lawyerId: row.lawyer_id, isPrimary: row.is_primary })),
  };
}

/** The service a version belongs to, for reloading the page after a write. */
async function serviceOf(versionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("service_versions")
    .select("service_id")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw fromPostgrest(error, "Loading version");
  if (data === null) throw new AppError("not_found", `No service version with id ${versionId}.`);
  return data.service_id;
}

/**
 * A status change is the quiet path: the assigned-lawyer policy's USING clause
 * filters the row out for anyone else, and PostgREST reports an empty array
 * with no error. `expectOne` is what turns that into a refusal (ADR-0012).
 */
async function setStatus(versionId: string, status: "draft" | "in_review" | "published") {
  const { data, error } = await supabase
    .from("service_versions")
    .update({ status })
    .eq("id", versionId)
    .select("service_id");
  if (error) throw fromPostgrest(error, "Changing the version's status");
  return expectOne(data ?? [], "Changing the version's status").service_id;
}

export const supabaseServiceVersionsApi: ServiceVersionsApi = {
  listForService: loadPage,

  async submitForReview(versionId) {
    return loadPage(await setStatus(versionId, "in_review"));
  },

  async returnToDraft(versionId) {
    return loadPage(await setStatus(versionId, "draft"));
  },

  async release(versionId) {
    // The RPC checks the role, the area, the state and the author itself and
    // raises on each, so a refusal arrives as P0001 → `validation` with the
    // rule in the message — never as silence.
    const { error } = await supabase.rpc("release_service_version", { target_version: versionId });
    if (error) throw fromPostgrest(error, "Signing the release");
    return loadPage(await serviceOf(versionId));
  },

  async putOnSale(versionId) {
    // The loud path: `service_versions_publish` raises on an unreleased
    // version, and the admin policy's WITH CHECK raises for anyone else.
    return loadPage(await setStatus(versionId, "published"));
  },

  async pause(versionId, input) {
    const { data, error } = await supabase
      .from("service_pauses")
      .insert({ service_version_id: versionId, reason: input.reason, note: input.note })
      .select("id");
    if (error?.code === "23505") {
      throw new AppError("conflict", "This version already has an open pause.", { cause: error });
    }
    if (error) throw fromPostgrest(error, "Pausing the version");
    expectOne(data ?? [], "Pausing the version");
    return loadPage(await serviceOf(versionId));
  },

  async lift(pauseId, resolution) {
    // `closed_by` is stamped by the guard from `auth.uid()`; sending it would
    // be a second opinion about who acted.
    const { data, error } = await supabase
      .from("service_pauses")
      .update({ closed_at: new Date().toISOString(), resolution })
      .eq("id", pauseId)
      .is("closed_at", null)
      .select("service_version_id");
    if (error) throw fromPostgrest(error, "Lifting the pause");
    const row = expectOne(data ?? [], "Lifting the pause");
    return loadPage(await serviceOf(row.service_version_id));
  },
};
