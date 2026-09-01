// Fixture implementation, annotated with the contract so drift fails to compile
// (ADR-0012, DoD §2).
//
// It does the same work the Supabase one does, by the same rules and in the same
// order: normalize the link before anything else, find the norm before creating
// one, derive freshness from `last_verified_at` and the interval rather than
// storing it. Those rules are the interesting part of this feature and they are
// assertable here without a database.
//
// What it cannot stand in for is RLS. The fixture store has no policies, so
// every norm is visible and every write succeeds — the states only a policy
// produces are asserted at the component, where the api is mocked outright.

import {
  fingerprintRevision,
  normalizeArticle,
  normalizeLawLink,
  NORMALIZER_VERSION,
} from "@legal-ai/law-refs";
import type { ArticlePreviewResponse } from "@legal-ai/law-refs";
import type { LawNormRow, ServiceLawRefRow } from "@legal-ai/db";
import { AppError } from "../../../shared/api/errors";
import {
  fixtureDelay,
  lawNormRows,
  serviceLawRefRows,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { LawApi } from "./contract";
import { freshnessOf } from "./freshness";
import type { LawNormListItem, NormDependent, ServiceLawRef } from "./types";

function dependentsOf(normId: string): NormDependent[] {
  return serviceLawRefRows
    .filter((ref) => ref.norm_id === normId)
    .map((ref) => ({
      serviceId: ref.service_id,
      // A service the fixture store does not hold is the stand-in for one RLS
      // hides, and renders as visibly odd text rather than taking the screen
      // down (DoD §5).
      serviceTitle: serviceRows.find((service) => service.id === ref.service_id)?.title ?? "",
    }));
}

/**
 * The source, as a table.
 *
 * Two articles of one act, because the interesting cases are "the article is
 * there" and "it is not" and a third article would demonstrate neither. The
 * text is short and obviously synthetic on purpose — a fixture that reads like
 * real legislation invites somebody to check it against the real thing, and
 * nothing here is authoritative. The real pages live in
 * `packages/law-refs/fixtures/` and are what the parser is actually held to.
 */
const FIXTURE_SOURCE: Record<string, string> = {
  "2947-14/105": [
    "Стаття 105. Припинення шлюбу внаслідок розірвання шлюбу",
    "",
    "Шлюб припиняється внаслідок його розірвання за спільною заявою подружжя.",
  ].join("\n"),
  "2947-14/106":
    "Стаття 106. Розірвання шлюбу органом державної реєстрації актів цивільного стану за заявою подружжя, яке не має дітей",
};

const FIXTURE_REDACTION_DATE = "2026-08-05";

/**
 * Read an article out of the table above, with the same reduction and the same
 * fingerprint format the fetcher uses.
 *
 * `fingerprintRevision` rather than a made-up string, so the fixture path
 * produces values that are `sha256:`-prefixed, comparable, and wrong in exactly
 * the ways the real ones would be wrong. A hand-written "fingerprint" here would
 * let a screen ship that never actually compares two of them.
 */
async function readFixtureArticle(actId: string, article: string): Promise<ArticlePreviewResponse> {
  const text = FIXTURE_SOURCE[`${actId}/${article}`];
  if (text === undefined) {
    return { ok: false, failure: { reason: "heading_mismatch" } };
  }

  const revision = await fingerprintRevision(text);
  if (!revision.ok) return { ok: false, failure: { reason: "text_blank" } };

  return {
    ok: true,
    reading: {
      actId,
      article,
      text: revision.revision.text,
      fingerprint: revision.revision.fingerprint,
      normalizerVersion: revision.revision.normalizerVersion,
      publishedRevisionDate: FIXTURE_REDACTION_DATE,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function toNorm(row: LawNormRow): LawNormListItem {
  const probeIntervalHours = row.probe_interval_hours ?? 0;

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
    freshness: freshnessOf(row.last_verified_at, probeIntervalHours),
    probeIntervalHours,
    intervalReason: row.interval_reason,
    lastCheckedAt: row.last_checked_at,
    lastVerifiedAt: row.last_verified_at,
    dependents: dependentsOf(row.id),
  };
}

function toRef(row: ServiceLawRefRow): ServiceLawRef {
  const norm = lawNormRows.find((candidate) => candidate.id === row.norm_id);
  if (norm === undefined) {
    throw new AppError("not_found", `Reference ${row.id} points at a norm that is not here.`);
  }

  return { id: row.id, reliedOn: row.relied_on, norm: toNorm(norm) };
}

function normById(normId: string): LawNormListItem {
  const row = lawNormRows.find((candidate) => candidate.id === normId);
  if (row === undefined) throw new AppError("not_found", `No norm with id ${normId}.`);
  return toNorm(row);
}

export const mockLawApi: LawApi = {
  async listNorms() {
    await fixtureDelay();

    // Sorted here rather than relied on from the fixture array, because nothing
    // depends on array order (DoD §5) — including the fixture's own.
    return [...lawNormRows]
      .sort((a, b) => {
        if (a.act_title !== b.act_title) return a.act_title < b.act_title ? -1 : 1;
        const left = a.article ?? "";
        const right = b.article ?? "";
        if (left !== right) return left < right ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      })
      .map(toNorm);
  },

  async listForService(serviceId) {
    await fixtureDelay();

    const service = serviceRows.find((candidate) => candidate.id === serviceId);
    if (service === undefined) {
      throw new AppError("not_found", `No service with id ${serviceId}.`);
    }

    const refs = serviceLawRefRows
      .filter((ref) => ref.service_id === serviceId)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map(toRef);

    return { serviceId: service.id, serviceTitle: service.title, refs };
  },

  async addReference(input) {
    await fixtureDelay();

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

    if (actScoped && (input.actScopeReason === null || input.actScopeReason.trim() === "")) {
      throw new AppError("validation", "Act-level tracking is recorded with its reason (§9.4).");
    }
    if (input.reliedOn.trim() === "") {
      throw new AppError("validation", "A reference records what it is relied on for (§9.5.6).");
    }

    // §9.3, and the half that matters: found before created, so the second
    // service to cite an article joins the row the first one entered rather than
    // starting a parallel watch of the same text.
    const existing = lawNormRows.find(
      (row) =>
        row.source === link.link.source &&
        row.act_id === link.link.actId &&
        row.article === article,
    );

    const normId = existing?.id ?? `norm-${link.link.actId}-${article ?? "act"}`;

    if (existing === undefined) {
      const now = new Date().toISOString();
      lawNormRows.push({
        id: normId,
        source: link.link.source,
        act_id: link.link.actId,
        act_title: input.actTitle,
        scope: actScoped ? "act" : "article",
        article,
        act_scope_reason: actScoped ? input.actScopeReason : null,
        source_url: input.url,
        canonical_url: link.link.canonicalUrl,
        state: "unverified",
        fingerprint: null,
        normalizer_version: 1,
        probe_interval: "7 days",
        probe_interval_hours: 168,
        interval_reason: null,
        last_checked_at: null,
        last_verified_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    const duplicate = serviceLawRefRows.some(
      (ref) => ref.service_id === input.serviceId && ref.norm_id === normId,
    );
    if (duplicate) {
      throw new AppError("conflict", "This service already records that norm.");
    }

    const now = new Date().toISOString();
    const row: ServiceLawRefRow = {
      id: `ref-${input.serviceId}-${normId}`,
      service_id: input.serviceId,
      norm_id: normId,
      relied_on: input.reliedOn,
      created_at: now,
      updated_at: now,
    };
    serviceLawRefRows.push(row);

    return toRef(row);
  },

  async previewArticle(input) {
    await fixtureDelay();

    const link = normalizeLawLink(input.url);
    if (!link.ok) {
      throw new AppError("validation", `The link was not recognized: ${link.reason}.`);
    }

    const article = normalizeArticle(input.article);
    if (!article.ok) {
      // The same answer the real fetcher gives an unreadable designator, and it
      // gives it without a request — there is nothing to look for.
      return { ok: false, failure: { reason: "heading_mismatch" } };
    }

    return await readFixtureArticle(link.link.actId, article.article);
  },

  async observeArticle(input) {
    await fixtureDelay();

    const row = lawNormRows.find((norm) => norm.id === input.normId);
    if (row === undefined) throw new AppError("not_found", "No such norm.");
    if (row.article === null) throw new AppError("validation", "Act-scoped norms are not fetched.");

    const read = await readFixtureArticle(row.act_id, row.article);
    if (!read.ok) {
      row.state = "unreachable";
      row.last_checked_at = new Date().toISOString();
      return { ok: false, failure: read.failure, state: "unreachable" };
    }

    const outcome =
      row.fingerprint === null
        ? ("first" as const)
        : row.fingerprint === read.reading.fingerprint
          ? ("unchanged" as const)
          : ("changed" as const);

    const confirmed = input.confirmedFingerprint === read.reading.fingerprint;

    // The fixture store has no `law_norms_adopt_revision` trigger, so the
    // register's fingerprint is carried over by hand here. That is the one place
    // this implementation reproduces a rule rather than obeying it, and it is
    // worth a line: the real path cannot get this wrong, because nothing but the
    // trigger is allowed to write the column.
    row.fingerprint = read.reading.fingerprint;
    row.normalizer_version = NORMALIZER_VERSION;
    row.last_checked_at = read.reading.fetchedAt;

    const state = confirmed
      ? ("verified" as const)
      : outcome === "changed"
        ? ("drifted" as const)
        : outcome === "first" || row.state === "unreachable"
          ? ("unverified" as const)
          : row.state;

    row.state = state;
    if (state === "verified") row.last_verified_at = read.reading.fetchedAt;

    return { ok: true, reading: read.reading, outcome, state, confirmed };
  },

  async removeReference(refId) {
    await fixtureDelay();

    const index = serviceLawRefRows.findIndex((ref) => ref.id === refId);
    if (index === -1) {
      // The live implementation reaches the same state through `expectOne` on a
      // delete that removed nothing, which is what an RLS denial looks like.
      throw new AppError("forbidden", `Removing the law reference: nothing was written.`);
    }

    serviceLawRefRows.splice(index, 1);
    return refId;
  },

  async setCadence(change) {
    await fixtureDelay();

    if (!Number.isFinite(change.hours) || change.hours <= 0) {
      throw new AppError("validation", "A tracking interval is a positive number of hours.");
    }

    const row = lawNormRows.find((candidate) => candidate.id === change.normId);
    if (row === undefined) throw new AppError("not_found", `No norm with id ${change.normId}.`);

    // The recommendation, as `recommended_probe_interval` computes it: daily
    // behind a published service, weekly otherwise. The fixture store holds no
    // version statuses for this purpose, so it asks the simpler question the
    // guard also asks — whether anything depends on the norm at all.
    const recommended = dependentsOf(row.id).length > 0 ? 24 : 168;
    if (change.hours !== recommended && (change.reason === null || change.reason.trim() === "")) {
      throw new AppError(
        "validation",
        "A tracking interval other than the recommended one is recorded with its reason (§9.8).",
      );
    }

    row.probe_interval_hours = change.hours;
    row.probe_interval = `${change.hours} hours`;
    row.interval_reason = change.reason;
    row.updated_at = new Date().toISOString();

    return normById(change.normId);
  },
};
