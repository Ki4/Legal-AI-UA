// Supabase implementation of LawApi.
//
// Two things shape every query here.
//
// **Dependents are fetched separately rather than nested.** A norm's dependents
// hang off `service_law_refs`, and a service's dependencies hang off the same
// table — so reading one through the other is a self-embed, which PostgREST will
// do and which nobody reading the select string afterwards can verify at a
// glance. Two flat queries and a join in memory say the same thing and are
// checkable.
//
// **`addReference` finds before it creates.** That is where §9.3 stops being a
// constraint and becomes behaviour: the second service to cite article 105
// attaches to the row the first one entered, and inherits its fingerprint, its
// cadence and its state. A create-then-catch-the-duplicate would work too and
// would leave every second citation looking like an error.

import type { QueryData } from "@supabase/supabase-js";
import { normalizeArticle, normalizeLawLink } from "@legal-ai/law-refs";
import { supabase } from "../../../app/supabase";
import { AppError, expectOne } from "../../../shared/api/errors";
import { fromPostgrest } from "../../../shared/api/postgrest";
import type { LawApi } from "./contract";
import { freshnessOf } from "./freshness";
import type { CadenceChange, LawNormListItem, NormDependent, ServiceLawRef } from "./types";

const NORM_SELECT = `
  id, source, act_id, act_title, scope, article, act_scope_reason,
  source_url, canonical_url, state, probe_interval_hours, interval_reason,
  last_checked_at, last_verified_at, created_at
` as const;

function normsQuery() {
  return supabase.from("law_norms").select(NORM_SELECT);
}

export type NormQueryRow = QueryData<ReturnType<typeof normsQuery>>[number];

const DEPENDENT_SELECT = `norm_id, service_id, services ( title )` as const;

function dependentsQuery() {
  return supabase.from("service_law_refs").select(DEPENDENT_SELECT);
}

export type DependentQueryRow = QueryData<ReturnType<typeof dependentsQuery>>[number];

/**
 * Dependents grouped by the norm they hang off.
 *
 * The optional chaining on the embed guards a state the generated types deny:
 * `db:types` writes a to-one embed as non-nullable because the foreign key is,
 * which is everything referential integrity knows and nothing about policies. A
 * service the reader may not see arrives as null whatever the key says, and a
 * screen with no `ErrorBoundary` cannot meet that as a throw (DoD §5).
 */
export function dependentsByNorm(rows: readonly DependentQueryRow[]): Map<string, NormDependent[]> {
  const byNorm = new Map<string, NormDependent[]>();

  for (const row of rows) {
    const list = byNorm.get(row.norm_id) ?? [];
    list.push({ serviceId: row.service_id, serviceTitle: row.services?.title ?? "" });
    byNorm.set(row.norm_id, list);
  }

  return byNorm;
}

/**
 * `probe_interval_hours` is `numeric`, which PostgREST hands over as a string
 * once it exceeds what a JS number holds exactly — and as a number otherwise. It
 * is a generated column and cannot be null, but the generated type says it can,
 * because Postgres reports every generated column as nullable.
 */
export function hoursOf(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (value === null) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNorm(
  row: NormQueryRow,
  dependents: readonly NormDependent[],
  now?: number,
): LawNormListItem {
  const probeIntervalHours = hoursOf(row.probe_interval_hours);

  return {
    id: row.id,
    source: row.source,
    actId: row.act_id,
    actTitle: row.act_title,
    scope: row.scope,
    article: row.article,
    actScopeReason: row.act_scope_reason,
    sourceUrl: row.source_url,
    canonicalUrl: row.canonical_url,
    state: row.state,
    freshness: freshnessOf(row.last_verified_at, probeIntervalHours, now),
    probeIntervalHours,
    intervalReason: row.interval_reason,
    lastCheckedAt: row.last_checked_at,
    lastVerifiedAt: row.last_verified_at,
    dependents: [...dependents],
  };
}

async function loadDependents(normIds: readonly string[]): Promise<Map<string, NormDependent[]>> {
  if (normIds.length === 0) return new Map();

  const { data, error } = await dependentsQuery().in("norm_id", [...normIds]);
  if (error) throw fromPostgrest(error, "Loading the services depending on these norms");

  return dependentsByNorm(data ?? []);
}

async function normById(normId: string): Promise<LawNormListItem> {
  const { data, error } = await normsQuery().eq("id", normId).maybeSingle();
  if (error) throw fromPostgrest(error, "Loading the norm");
  if (data === null) throw new AppError("not_found", `No norm with id ${normId}.`);

  const dependents = await loadDependents([normId]);
  return toNorm(data, dependents.get(normId) ?? []);
}

export const supabaseLawApi: LawApi = {
  async listNorms() {
    // Ordered by act and article rather than by entry date: the register is read
    // as a reference, and a reader looking for "the Family Code ones" wants them
    // adjacent. `id` settles ties, so the list does not reshuffle between loads.
    const { data, error } = await normsQuery()
      .order("act_title", { ascending: true })
      .order("article", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true });

    if (error) throw fromPostgrest(error, "Loading the law register");

    const rows = data ?? [];
    const dependents = await loadDependents(rows.map((row) => row.id));

    return rows.map((row) => toNorm(row, dependents.get(row.id) ?? []));
  },

  async listForService(serviceId) {
    // Asked first, so a mistyped id is "no such service" rather than a service
    // with no dependencies — which is what every real service looks like today
    // (DoD §4).
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, title")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) throw fromPostgrest(serviceError, "Loading the service");
    if (service === null) throw new AppError("not_found", `No service with id ${serviceId}.`);

    const { data, error } = await supabase
      .from("service_law_refs")
      .select(`id, relied_on, law_norms ( ${NORM_SELECT} )`)
      .eq("service_id", serviceId)
      .order("id", { ascending: true });

    if (error) throw fromPostgrest(error, "Loading the law references");

    const rows = data ?? [];
    const norms = rows.map((row) => row.law_norms).filter((norm) => norm !== null);
    const dependents = await loadDependents(norms.map((norm) => norm.id));

    const refs: ServiceLawRef[] = [];
    for (const row of rows) {
      const norm = row.law_norms;
      // A reference whose norm the reader cannot see is not renderable as
      // anything honest, and `law_norms_select_staff` lets both roles read every
      // norm — so this drops nothing today. It is here because a policy narrowed
      // later must not turn a row into a crash.
      if (norm === null) continue;
      refs.push({
        id: row.id,
        reliedOn: row.relied_on,
        norm: toNorm(norm, dependents.get(norm.id) ?? []),
      });
    }

    return { serviceId: service.id, serviceTitle: service.title, refs };
  },

  async addReference(input) {
    const link = normalizeLawLink(input.url);
    if (!link.ok) {
      throw new AppError("validation", `The link was not recognized: ${link.reason}.`);
    }

    const actScoped = input.article === null;
    let article: string | null = null;

    if (!actScoped) {
      const parsed = normalizeArticle(input.article ?? "");
      if (!parsed.ok) {
        throw new AppError("validation", `The article was not recognized: ${parsed.reason}.`);
      }
      article = parsed.article;
    }

    const normId = await findOrCreateNorm({
      source: link.link.source,
      actId: link.link.actId,
      actTitle: input.actTitle,
      article,
      actScopeReason: actScoped ? input.actScopeReason : null,
      sourceUrl: input.url,
      canonicalUrl: link.link.canonicalUrl,
    });

    const { data, error } = await supabase
      .from("service_law_refs")
      .insert({ service_id: input.serviceId, norm_id: normId, relied_on: input.reliedOn })
      .select("id, relied_on");

    if (error) throw fromPostgrest(error, "Recording the law reference");

    // An insert denied by `with check` raises and never reaches here; this
    // covers the shape where a policy filters the returned row instead, which
    // would otherwise report a write that did not happen (DoD §3).
    const row = expectOne(data ?? [], "Recording the law reference");

    return { id: row.id, reliedOn: row.relied_on, norm: await normById(normId) };
  },

  async removeReference(refId) {
    const { data, error } = await supabase
      .from("service_law_refs")
      .delete()
      .eq("id", refId)
      .select("id");

    if (error) throw fromPostgrest(error, "Removing the law reference");

    // The delete a `using` clause refuses removes no rows and reports no error.
    // Without this the screen would drop the row from the list and reload it
    // back a second later, which reads as a bug rather than as a refusal.
    return expectOne(data ?? [], "Removing the law reference").id;
  },

  async setCadence(change) {
    assertPositiveHours(change);

    const { data, error } = await supabase
      .from("law_norms")
      .update({
        probe_interval: `${change.hours} hours`,
        interval_reason: change.reason,
      })
      .eq("id", change.normId)
      .select("id");

    if (error) throw fromPostgrest(error, "Changing the tracking interval");

    expectOne(data ?? [], "Changing the tracking interval");
    return normById(change.normId);
  },
};

/** Refused here as well as by the guard, so the reader is not asked to wait for a round trip. */
function assertPositiveHours(change: CadenceChange): void {
  if (!Number.isFinite(change.hours) || change.hours <= 0) {
    throw new AppError("validation", "A tracking interval is a positive number of hours.");
  }
}

interface NormIdentity {
  source: "zakon_rada";
  actId: string;
  actTitle: string;
  article: string | null;
  actScopeReason: string | null;
  sourceUrl: string;
  canonicalUrl: string;
}

/**
 * §9.3 as behaviour rather than as a constraint.
 *
 * The lookup and the insert are not atomic, so two lawyers entering the same
 * article at once will race. The unique constraint decides that race and the
 * loser re-reads — which is the correct outcome and the reason the retry exists:
 * without it, the second lawyer would be shown a duplicate-key failure for
 * having done nothing wrong.
 */
async function findOrCreateNorm(identity: NormIdentity): Promise<string> {
  const existing = await findNorm(identity);
  if (existing !== null) return existing;

  const { data, error } = await supabase
    .from("law_norms")
    .insert({
      source: identity.source,
      act_id: identity.actId,
      act_title: identity.actTitle,
      scope: identity.article === null ? "act" : "article",
      article: identity.article,
      act_scope_reason: identity.actScopeReason,
      source_url: identity.sourceUrl,
      canonical_url: identity.canonicalUrl,
    })
    .select("id");

  if (error) {
    // 23505: somebody entered this norm between the lookup and the insert.
    const conflict = await findNorm(identity);
    if (conflict !== null) return conflict;
    throw fromPostgrest(error, "Entering the norm into the register");
  }

  return expectOne(data ?? [], "Entering the norm into the register").id;
}

async function findNorm(identity: NormIdentity): Promise<string | null> {
  const base = supabase
    .from("law_norms")
    .select("id")
    .eq("source", identity.source)
    .eq("act_id", identity.actId);

  const { data, error } =
    identity.article === null
      ? await base.is("article", null).maybeSingle()
      : await base.eq("article", identity.article).maybeSingle();

  if (error) throw fromPostgrest(error, "Looking for the norm in the register");
  return data?.id ?? null;
}
