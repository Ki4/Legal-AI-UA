// The stand-in for the database, shared by every feature's fixture
// implementation. It exists because features read the *same* rows: if each one
// kept private copies, a write through one feature would be invisible to
// another, and the fixtures would disagree with each other in a way the real
// database never could. That divergence is exactly what ADR-0012 warns fixtures
// must not have.
//
// This file disappears when the Supabase implementations land. Nothing outside
// a `*.mock.ts` may import it.

import { mockProfiles, mockServices, mockServiceVersions } from "@legal-ai/db";
import type { ProfileRow, ServiceRow, ServiceVersionRow } from "@legal-ai/db";

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
export const profileRows: ProfileRow[] = mockProfiles.map((row) => ({ ...row }));

/**
 * The version a catalogue screen reflects: the live one — published or paused —
 * when there is one, otherwise the newest.
 *
 * Deliberately not `.find`. Array order is meaningless here and will be
 * meaningless in a Supabase result too, and the schema only guarantees one
 * *published* version per service — `paused` is outside that partial unique
 * index, so two live rows are reachable. Picking the highest version number
 * among the candidates makes the answer the same every time.
 */
export function currentVersionRowOf(serviceId: string): ServiceVersionRow | null {
  const own = serviceVersionRows.filter((version) => version.serviceId === serviceId);

  const highest = (rows: ServiceVersionRow[]): ServiceVersionRow | null =>
    rows.reduce<ServiceVersionRow | null>(
      (best, row) => (best === null || row.version > best.version ? row : best),
      null,
    );

  const live = own.filter((row) => row.status === "published" || row.status === "paused");
  return live.length > 0 ? highest(live) : highest(own);
}

export function profileById(id: string): ProfileRow | null {
  return profileRows.find((profile) => profile.id === id) ?? null;
}
