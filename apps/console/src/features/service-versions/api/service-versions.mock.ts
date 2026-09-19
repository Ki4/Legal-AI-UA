// Fixture implementation of ServiceVersionsApi.
//
// It mirrors what the *data* does, not what RLS does: there is no session here,
// so it cannot know whether the caller signs for the area or holds `admin`.
// What it does mirror, rule for rule, are the triggers and constraints the
// three acts pass through — a release on a draft, a sale before a signature, a
// second open pause, a pause on an unpublished version — because those are
// refusals the screen has to have met before it meets a database. Rights are
// asserted in `verify_practice_area_signatories.sql` and
// `verify_service_pauses.sql`.
//
// Writes go to the shared fixture store, so a version this feature pauses is
// paused on the catalogue too — one store behind every screen, the way one
// database is.

import { AppError } from "../../../shared/api/errors";
import {
  assignmentsOf,
  fixtureDelay,
  practiceAreaByCode,
  practiceAreaSignatoryRows,
  profileRows,
  servicePauseRows,
  serviceRows,
  serviceVersionPriceRows,
  serviceVersionRows,
} from "../../../shared/api/fixture-store";
import type { ServiceVersionsApi } from "./contract";
import {
  staffIdsOf,
  toPracticeAreaRef,
  toSignatories,
  toVersionItems,
  type StaffNames,
} from "./mapping";
import type { ServiceVersionsPage } from "./types";

/**
 * Who the fixtures are pretending to be signed in as, for the acts that stamp a
 * name. Taras signs for family law (as Olena's reviewer) and heads civil law
 * alone, so every branch of the four-eyes rule is reachable from one caller:
 * he releases Olena's family-law drafts; he is refused his own family-law
 * drafts, because Olena also signs; he releases his own civil-law drafts and
 * the row is flagged, because nobody else signs there.
 */
export const FIXTURE_CALLER = "usr-taras";

/** The admin the fixtures stamp on a sale. Sales are an admin's act (ADR-0027). */
export const FIXTURE_ADMIN = "usr-admin";

function namesOf(ids: readonly string[]): StaffNames {
  const names = new Map<string, string>();
  for (const id of ids) {
    const profile = profileRows.find((row) => row.id === id);
    if (profile?.full_name != null) names.set(id, profile.full_name);
  }
  return names;
}

function requireService(id: string) {
  const service = serviceRows.find((candidate) => candidate.id === id);
  if (!service) throw new AppError("not_found", `No service with id ${id}.`);
  return service;
}

function requireVersion(id: string) {
  const version = serviceVersionRows.find((candidate) => candidate.id === id);
  if (!version) throw new AppError("not_found", `No service version with id ${id}.`);
  return version;
}

function toPage(serviceId: string): ServiceVersionsPage {
  const service = requireService(serviceId);
  const versions = serviceVersionRows.filter((row) => row.service_id === service.id);
  const versionIds = new Set(versions.map((row) => row.id));
  const pauses = servicePauseRows.filter((row) => versionIds.has(row.service_version_id));
  const signatories = practiceAreaSignatoryRows.filter(
    (row) => row.practice_area === service.practice_area,
  );
  const names = namesOf(staffIdsOf(versions, pauses, signatories));

  return {
    service: {
      id: service.id,
      title: service.title,
      practiceArea: toPracticeAreaRef(practiceAreaByCode(service.practice_area)),
      practiceAreaCode: service.practice_area,
    },
    versions: toVersionItems({
      versions,
      pauses,
      prices: serviceVersionPriceRows,
      names,
    }),
    signatories: toSignatories(signatories, names),
    assignments: assignmentsOf(service.id).map((row) => ({
      lawyerId: row.lawyer_id,
      isPrimary: row.is_primary,
    })),
  };
}

/** A `raise exception` in a guard arrives as P0001, which `fromPostgrest` maps to `validation`. */
function refuse(message: string): never {
  throw new AppError("validation", message);
}

export const mockServiceVersionsApi: ServiceVersionsApi = {
  async listForService(serviceId) {
    await fixtureDelay();
    return toPage(serviceId);
  },

  async submitForReview(versionId) {
    await fixtureDelay();
    const version = requireVersion(versionId);
    // The assigned-lawyer policy fences `status` to the pre-publication values
    // and `published_at is null`; a version past that is not theirs to move.
    if (version.published_at !== null || version.status !== "draft") {
      refuse(`service version ${versionId} is ${version.status}; only a draft goes to review`);
    }
    version.status = "in_review";
    return toPage(version.service_id);
  },

  async returnToDraft(versionId) {
    await fixtureDelay();
    const version = requireVersion(versionId);
    if (version.published_at !== null || version.status !== "in_review") {
      refuse(
        `service version ${versionId} is ${version.status}; only a version in review steps back`,
      );
    }
    version.status = "draft";
    // `service_versions_withdraw_release`: a step back to draft clears the
    // signature — it stood under a text that is being reopened.
    version.released_at = null;
    version.released_by = null;
    version.self_released = false;
    return toPage(version.service_id);
  },

  async release(versionId) {
    await fixtureDelay();
    const version = requireVersion(versionId);
    const service = requireService(version.service_id);

    // The RPC's refusals, in its order.
    if (version.published_at !== null) {
      refuse(`service version ${versionId} is published; there is nothing left to sign`);
    }
    if (version.released_at !== null) {
      refuse(`service version ${versionId} is already released; one signature per text`);
    }
    if (version.status !== "in_review") {
      refuse(
        `service version ${versionId} is ${version.status}; only a version in review is released`,
      );
    }
    const signatories = practiceAreaSignatoryRows.filter(
      (row) => row.practice_area === service.practice_area,
    );
    if (!signatories.some((row) => row.lawyer_id === FIXTURE_CALLER)) {
      refuse(`you do not sign for practice area ${service.practice_area}`);
    }
    const self = version.created_by === FIXTURE_CALLER;
    if (self && signatories.some((row) => row.lawyer_id !== FIXTURE_CALLER)) {
      refuse(
        `you authored this version; another signatory of ${service.practice_area} has to release it (ADR-0027)`,
      );
    }

    version.released_at = new Date().toISOString();
    version.released_by = FIXTURE_CALLER;
    version.self_released = self;
    return toPage(version.service_id);
  },

  async putOnSale(versionId) {
    await fixtureDelay();
    const version = requireVersion(versionId);

    // `service_versions_publish`, restated twice since 2026-08-11 and mirrored
    // here in its current form: no sale without a signature, none without an
    // accountable lawyer, and the live predecessor archived by the same act —
    // its open pause closed as `new_version` naming this one (§5.7).
    if (version.published_at !== null) {
      refuse(`service version ${versionId} is already on sale`);
    }
    if (version.released_at === null) {
      refuse(
        `service version ${versionId} has not been released; a sale needs a signature (ADR-0027)`,
      );
    }
    if (!assignmentsOf(version.service_id).some((row) => row.is_primary)) {
      refuse("cannot publish a version of a service with no assigned lawyer");
    }

    const now = new Date().toISOString();
    for (const other of serviceVersionRows) {
      if (
        other.service_id === version.service_id &&
        other.id !== version.id &&
        (other.status === "published" || other.status === "paused")
      ) {
        const open = servicePauseRows.find(
          (p) => p.service_version_id === other.id && p.closed_at === null,
        );
        if (open) {
          open.closed_at = now;
          open.closed_by = FIXTURE_ADMIN;
          open.resolution = "new_version";
          open.replaced_by = version.id;
        }
        other.status = "archived";
      }
    }

    version.status = "published";
    version.published_at = now;
    version.published_by = FIXTURE_ADMIN;
    return toPage(version.service_id);
  },

  async pause(versionId, input) {
    await fixtureDelay();
    const version = requireVersion(versionId);

    if (version.status !== "published" && version.status !== "paused") {
      refuse(`only a version on sale is paused; ${versionId} is ${version.status}`);
    }
    if (servicePauseRows.some((p) => p.service_version_id === versionId && p.closed_at === null)) {
      // The partial unique index — a second open row is a 23505.
      throw new AppError("conflict", `service version ${versionId} already has an open pause.`);
    }

    servicePauseRows.push({
      id: `pause-${versionId}-${servicePauseRows.length + 1}`,
      service_version_id: versionId,
      reason: input.reason,
      note: input.note,
      signal_id: null,
      opened_by: FIXTURE_CALLER,
      opened_at: new Date().toISOString(),
      closed_by: null,
      closed_at: null,
      resolution: null,
      replaced_by: null,
      holders_notified_at: null,
    });
    // `service_pauses_apply`: the version follows the row.
    version.status = "paused";
    return toPage(version.service_id);
  },

  async lift(pauseId, resolution) {
    await fixtureDelay();
    const pause = servicePauseRows.find((row) => row.id === pauseId);
    if (!pause) throw new AppError("not_found", `No pause with id ${pauseId}.`);
    if (pause.closed_at !== null) refuse("a closed pause is history");

    const version = requireVersion(pause.service_version_id);
    pause.closed_at = new Date().toISOString();
    pause.closed_by = FIXTURE_CALLER;
    pause.resolution = resolution;
    version.status = resolution === "resumed" ? "published" : "archived";
    return toPage(version.service_id);
  },
};
