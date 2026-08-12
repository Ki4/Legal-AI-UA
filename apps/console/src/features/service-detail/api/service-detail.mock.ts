// Fixture implementation of ServiceDetailApi.
//
// It mirrors what the *data* does, not what RLS does: there is no session here,
// so it cannot know whether the caller is an admin. Rights are the database's
// job and are verified in `supabase/snippets/verify_service_assignments.sql`.
// What this file must get right is the shape of every answer, including the
// failures — a fixture that only knows how to succeed builds screens that have
// never seen a refusal.

import { AppError, expectOne } from "../../../shared/api/errors";
import {
  assignmentsOf,
  currentVersionRowOf,
  fixtureDelay,
  priceRowOf,
  profileById,
  profileRows,
  serviceAssignmentRows,
  serviceRows,
} from "../../../shared/api/fixture-store";
import type { ServiceDetailApi } from "./contract";
import type { AssignableLawyer, LawyerRef, ServiceDetail } from "./types";

function requireService(id: string) {
  // Reads the shared fixture store, not a private copy: a write made through
  // another feature has to be visible here, the way it would be with one
  // database behind both screens.
  const service = serviceRows.find((candidate) => candidate.id === id);
  if (!service) {
    throw new AppError("not_found", `No service with id ${id}.`);
  }
  return service;
}

function toDetail(serviceId: string): ServiceDetail {
  const service = requireService(serviceId);
  const version = currentVersionRowOf(service.id);
  const assignments = assignmentsOf(service.id);

  // Two different nulls, kept apart (DoD §5): nobody attached, versus attached
  // to a profile this caller cannot read.
  const toRef = (lawyerId: string): LawyerRef => ({
    id: lawyerId,
    fullName: profileById(lawyerId)?.full_name ?? null,
  });

  const primary = assignments.find((a) => a.is_primary);
  const cover = assignments
    .filter((a) => !a.is_primary)
    .map((a) => toRef(a.lawyer_id))
    .sort((a, b) => {
      if (a.fullName === null) return b.fullName === null ? a.id.localeCompare(b.id) : 1;
      if (b.fullName === null) return -1;
      return a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
    });

  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    summary: service.summary,
    primaryLawyer: primary === undefined ? null : toRef(primary.lawyer_id),
    coverLawyers: cover,
    currentVersion:
      version === null
        ? null
        : {
            version: version.version,
            status: version.status,
            generationMode: version.generation_mode,
            reviewMode: version.review_mode,
            priceMinor: priceRowOf(version.id)?.amount_minor ?? null,
            currency: priceRowOf(version.id)?.currency ?? null,
            publishedAt: version.published_at,
          },
    createdAt: service.created_at,
    updatedAt: service.updated_at,
  };
}

export const mockServiceDetailApi: ServiceDetailApi = {
  async get(id) {
    await fixtureDelay();
    return toDetail(id);
  },

  async listAssignableLawyers() {
    await fixtureDelay();

    return profileRows
      .filter((profile) => profile.role === "lawyer")
      .map((profile): AssignableLawyer => ({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
      }))
      .sort((a, b) => {
        if (a.fullName === null) return b.fullName === null ? a.id.localeCompare(b.id) : 1;
        if (b.fullName === null) return -1;
        return a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
      });
  },

  async setPrimaryLawyer(id, lawyerId) {
    await fixtureDelay();
    const service = requireService(id);

    if (lawyerId !== null && profileById(lawyerId) === null) {
      // The real column carries a foreign key, so this is a 23503 there and a
      // validation error on both sides of the swap point.
      throw new AppError("validation", `No profile with id ${lawyerId}.`);
    }

    // Mirrors set_primary_lawyer: the previous holder is demoted rather than
    // detached, because losing accountability is not losing access.
    for (const row of serviceAssignmentRows) {
      if (row.service_id === id && row.is_primary) row.is_primary = false;
    }

    if (lawyerId !== null) {
      const existing = serviceAssignmentRows.find(
        (row) => row.service_id === id && row.lawyer_id === lawyerId,
      );
      if (existing) {
        existing.is_primary = true;
      } else {
        serviceAssignmentRows.push({
          service_id: id,
          lawyer_id: lawyerId,
          is_primary: true,
          assigned_at: new Date().toISOString(),
          assigned_by: null,
        });
      }
    }

    service.updated_at = new Date().toISOString();
    return toDetail(id);
  },

  async addCover(id, lawyerId) {
    await fixtureDelay();
    requireService(id);

    if (profileById(lawyerId) === null) {
      throw new AppError("validation", `No profile with id ${lawyerId}.`);
    }

    if (serviceAssignmentRows.some((row) => row.service_id === id && row.lawyer_id === lawyerId)) {
      // The primary key is (service_id, lawyer_id): attaching someone twice is
      // the same collision whether they are cover or accountable.
      throw new AppError(
        "conflict",
        "That lawyer is already attached to this service, as cover or as the accountable lawyer.",
      );
    }

    serviceAssignmentRows.push({
      service_id: id,
      lawyer_id: lawyerId,
      is_primary: false,
      assigned_at: new Date().toISOString(),
      assigned_by: null,
    });

    return toDetail(id);
  },

  async removeCover(id, lawyerId) {
    await fixtureDelay();
    requireService(id);

    const index = serviceAssignmentRows.findIndex(
      (row) => row.service_id === id && row.lawyer_id === lawyerId && !row.is_primary,
    );

    // Deliberately routed through the same helper the Supabase implementation
    // uses, so both sides of the swap point fail with the same message. A
    // deletion that matches nothing is the silent denial ADR-0012 is about.
    const removed = index === -1 ? [] : serviceAssignmentRows.splice(index, 1);
    expectOne(removed, "Removing cover");

    return toDetail(id);
  },
};
