// The stand-in for the database, shared by every feature's fixture
// implementation. It exists because features read the *same* rows: if each one
// kept private copies, a write through one feature would be invisible to
// another, and the fixtures would disagree with each other in a way the real
// database never could. That divergence is exactly what ADR-0012 warns fixtures
// must not have.
//
// Rows here are snake_case because rows are snake_case — they stand in for what
// Postgres returns. The camelCase view model is the api/ layer's output, not its
// input.
//
// This file disappears when the Supabase implementations land. Nothing outside
// a `*.mock.ts` may import it.

import {
  mockAuditEvents,
  mockClients,
  mockOrders,
  mockPracticeAreas,
  mockProfiles,
  mockServiceAssignments,
  mockServices,
  mockServiceVersionPrices,
  mockServiceVersions,
} from "@legal-ai/db";
import type {
  AuditEventRow,
  ClientRow,
  OrderRow,
  PracticeAreaRow,
  ProfileRow,
  ServiceAssignmentRow,
  ServiceRow,
  ServiceVersionPriceRow,
  ServiceVersionRow,
} from "@legal-ai/db";

/**
 * Every fixture implementation awaits this, so loading states get built rather
 * than discovered later against a real network.
 *
 * Zero under test. The delay exists for a human looking at a screen; paid on
 * every call in a suite it turns twenty assertions into several seconds, and a
 * slow suite is one that stops being run.
 */
export function fixtureDelay(): Promise<void> {
  const ms = import.meta.env.MODE === "test" ? 0 : 140;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const serviceRows: ServiceRow[] = mockServices.map((row) => ({ ...row }));
export const serviceVersionRows: ServiceVersionRow[] = mockServiceVersions.map((row) => ({
  ...row,
}));
export const serviceVersionPriceRows: ServiceVersionPriceRow[] = mockServiceVersionPrices.map(
  (row) => ({ ...row }),
);
export const serviceAssignmentRows: ServiceAssignmentRow[] = mockServiceAssignments.map((row) => ({
  ...row,
}));
export const profileRows: ProfileRow[] = mockProfiles.map((row) => ({ ...row }));
export const practiceAreaRows: PracticeAreaRow[] = mockPracticeAreas.map((row) => ({ ...row }));
export const auditEventRows: AuditEventRow[] = mockAuditEvents.map((row) => ({ ...row }));
export const clientRows: ClientRow[] = mockClients.map((row) => ({ ...row }));
export const orderRows: OrderRow[] = mockOrders.map((row) => ({ ...row }));

/**
 * The reference row a service points at. Null when the code resolves to
 * nothing, which the real embed can also return — the api/ layer decides what
 * to render for it, and both implementations must be given the same chance to.
 */
export function practiceAreaByCode(code: string): PracticeAreaRow | null {
  return practiceAreaRows.find((row) => row.code === code) ?? null;
}

/** Every lawyer attached to a service, accountable or cover. */
export function assignmentsOf(serviceId: string): ServiceAssignmentRow[] {
  return serviceAssignmentRows.filter((row) => row.service_id === serviceId);
}

/**
 * The version a catalogue screen reflects: the live one — published or paused —
 * when there is one, otherwise the newest.
 *
 * Deliberately not `.find`. Array order is meaningless here and will be
 * meaningless in a Supabase result too. The schema does now guarantee a single
 * live version per service — the partial unique index covers `published` and
 * `paused` together, and occupying that slot requires publication — but a
 * fixture store is not the schema, and picking the highest version number among
 * the candidates makes the answer the same every time regardless.
 */
export function currentVersionRowOf(serviceId: string): ServiceVersionRow | null {
  const own = serviceVersionRows.filter((version) => version.service_id === serviceId);

  const highest = (rows: ServiceVersionRow[]): ServiceVersionRow | null =>
    rows.reduce<ServiceVersionRow | null>(
      (best, row) => (best === null || row.version > best.version ? row : best),
      null,
    );

  const live = own.filter((row) => row.status === "published" || row.status === "paused");
  return live.length > 0 ? highest(live) : highest(own);
}

/**
 * The platform bills in UAH (spec §8). A version may legitimately have no price
 * row at all — an unpriced draft — which is why this returns null rather than
 * inventing a zero.
 */
export function priceRowOf(versionId: string, currency = "UAH"): ServiceVersionPriceRow | null {
  return (
    serviceVersionPriceRows.find(
      (row) => row.service_version_id === versionId && row.currency === currency,
    ) ?? null
  );
}

/** Null for an id no client row has — nothing in the fixtures hides a client. */
export function clientById(id: string): ClientRow | null {
  return clientRows.find((row) => row.id === id) ?? null;
}

export function profileById(id: string): ProfileRow | null {
  return profileRows.find((profile) => profile.id === id) ?? null;
}
