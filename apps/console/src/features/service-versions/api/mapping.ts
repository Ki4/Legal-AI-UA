// Rows → view model, pure. Both implementations run their rows through here,
// so the decisions below — which shape a release takes, what a legacy row says,
// how pauses sort — are made once and tested without a database.

import type {
  PracticeAreaRow,
  PracticeAreaSignatoryRow,
  ServicePauseRow,
  ServiceVersionPriceRow,
  ServiceVersionRow,
} from "@legal-ai/db";
import type {
  PauseItem,
  PracticeAreaRef,
  Release,
  Signatory,
  StaffRef,
  VersionItem,
} from "./types";

/** The currency the catalogue screens display (spec §8). */
export const DISPLAY_CURRENCY = "UAH";

/** Profile id → full name, for the ids that resolved to a readable profile. */
export type StaffNames = ReadonlyMap<string, string>;

export function toStaffRef(id: string, names: StaffNames): StaffRef {
  return { id, fullName: names.get(id) ?? null };
}

/**
 * Three shapes from two columns. `released_at` without `released_by` is the
 * legacy row: the migration stamped `published_at` into it for versions that
 * were on sale before ADR-0027 and left the name empty, because nobody signed.
 * Rendering that as "not released" would contradict the sale; rendering it as
 * signed would invent a signatory.
 */
export function toRelease(row: ServiceVersionRow, names: StaffNames): Release {
  if (row.released_at === null) return { kind: "none" };
  if (row.released_by === null) return { kind: "unsigned", at: row.released_at };
  return {
    kind: "signed",
    by: toStaffRef(row.released_by, names),
    at: row.released_at,
    selfReleased: row.self_released,
  };
}

export function toPauseItem(
  row: ServicePauseRow,
  names: StaffNames,
  versionNumberOf: (versionId: string) => number | null,
): PauseItem {
  const outcome: PauseItem["outcome"] =
    row.closed_at === null || row.resolution === null
      ? { kind: "open" }
      : {
          kind: "closed",
          at: row.closed_at,
          by: row.closed_by === null ? null : toStaffRef(row.closed_by, names),
          resolution: row.resolution,
          replacedByVersion: row.replaced_by === null ? null : versionNumberOf(row.replaced_by),
        };

  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    openedBy: row.opened_by === null ? null : toStaffRef(row.opened_by, names),
    openedAt: row.opened_at,
    outcome,
  };
}

export interface VersionSources {
  versions: readonly ServiceVersionRow[];
  pauses: readonly ServicePauseRow[];
  prices: readonly ServiceVersionPriceRow[];
  names: StaffNames;
}

/**
 * Newest version first, and within a version its pauses newest first. Sorted
 * here rather than by the query so a fixture and an embed agree (DoD §5:
 * nothing depends on array order).
 */
export function toVersionItems(sources: VersionSources): VersionItem[] {
  const numberOf = (versionId: string): number | null =>
    sources.versions.find((row) => row.id === versionId)?.version ?? null;

  return [...sources.versions]
    .sort((a, b) => b.version - a.version)
    .map((row): VersionItem => {
      const price =
        sources.prices.find(
          (p) => p.service_version_id === row.id && p.currency === DISPLAY_CURRENCY,
        ) ?? null;

      const pauses = sources.pauses
        .filter((p) => p.service_version_id === row.id)
        .sort((a, b) => b.opened_at.localeCompare(a.opened_at) || b.id.localeCompare(a.id))
        .map((p) => toPauseItem(p, sources.names, numberOf));

      // The schema allows one open pause per version; `find` is safe because
      // the alternative — several open rows — is a state the unique index
      // refuses, and a fixture that produced it would be wrong, not the mapper.
      const openPause = pauses.find((p) => p.outcome.kind === "open") ?? null;

      return {
        id: row.id,
        version: row.version,
        status: row.status,
        generationMode: row.generation_mode,
        reviewMode: row.review_mode,
        priceMinor: price?.amount_minor ?? null,
        currency: price?.currency ?? null,
        createdAt: row.created_at,
        author: row.created_by === null ? null : toStaffRef(row.created_by, sources.names),
        release: toRelease(row, sources.names),
        sale:
          row.published_at === null
            ? null
            : {
                by: row.published_by === null ? null : toStaffRef(row.published_by, sources.names),
                at: row.published_at,
              },
        openPause,
        pauses,
      };
    });
}

/** Head first, then reviewers by name; nameless rows last, as everywhere. */
export function toSignatories(
  rows: readonly PracticeAreaSignatoryRow[],
  names: StaffNames,
): Signatory[] {
  return rows
    .map((row): Signatory => ({ lawyer: toStaffRef(row.lawyer_id, names), isHead: row.is_head }))
    .sort((a, b) => {
      if (a.isHead !== b.isHead) return a.isHead ? -1 : 1;
      const an = a.lawyer.fullName;
      const bn = b.lawyer.fullName;
      if (an === null) return bn === null ? a.lawyer.id.localeCompare(b.lawyer.id) : 1;
      if (bn === null) return -1;
      return an.localeCompare(bn) || a.lawyer.id.localeCompare(b.lawyer.id);
    });
}

export function toPracticeAreaRef(row: PracticeAreaRow | null): PracticeAreaRef | null {
  if (row === null) return null;
  return { code: row.code, labels: { uk: row.label_uk, en: row.label_en } };
}

/** Every profile id a page names, so one lookup fetches all of them. */
export function staffIdsOf(
  versions: readonly ServiceVersionRow[],
  pauses: readonly ServicePauseRow[],
  signatories: readonly PracticeAreaSignatoryRow[],
): string[] {
  const ids = new Set<string>();
  for (const v of versions) {
    for (const id of [v.created_by, v.released_by, v.published_by]) if (id !== null) ids.add(id);
  }
  for (const p of pauses) {
    for (const id of [p.opened_by, p.closed_by]) if (id !== null) ids.add(id);
  }
  for (const s of signatories) ids.add(s.lawyer_id);
  return [...ids];
}
