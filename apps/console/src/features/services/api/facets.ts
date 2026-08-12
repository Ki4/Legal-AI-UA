// Counting the catalogue, and then narrowing it.
//
// This lives in its own module rather than beside either implementation because
// both run it. What a filter chip *counts* and what that chip then *hides* must
// not be two answers, and the surest way to keep them one is to have one
// implementation — which also means the fixture tests exercise the same code
// the browser does, rather than a plausible imitation of it.
//
// It is deliberately free of any Supabase import: a fixture implementation that
// reached into `services.supabase.ts` would drag the client along with it, and
// the client throws at import time when the env vars are absent, which under
// Vitest they are.

import type {
  AreaFacet,
  CatalogueFilter,
  CatalogueView,
  ServiceListItem,
  StatusFacet,
} from "./types";

export function facetAndFilter(all: ServiceListItem[], filter?: CatalogueFilter): CatalogueView {
  const areas = new Map<string, AreaFacet>();
  const statuses = new Map<string, StatusFacet>();

  for (const item of all) {
    const area = areas.get(item.practiceArea.code);
    if (area === undefined) {
      areas.set(item.practiceArea.code, { area: item.practiceArea, count: 1 });
    } else {
      area.count += 1;
    }

    // A service with no versions has no status. It is counted in the total and
    // in its area, and under no status — which is honest: there is no status
    // filter that should reveal it.
    const status = item.currentVersion?.status;
    if (status !== undefined) {
      const facet = statuses.get(status);
      if (facet === undefined) {
        statuses.set(status, { status, count: 1 });
      } else {
        facet.count += 1;
      }
    }
  }

  const wantedAreas = filter?.areas ?? [];
  const wantedStatuses = filter?.status ?? [];

  const items = all
    .filter((item) => wantedAreas.length === 0 || wantedAreas.includes(item.practiceArea.code))
    .filter((item) => {
      if (wantedStatuses.length === 0) return true;
      const status = item.currentVersion?.status;
      return status !== undefined && wantedStatuses.includes(status);
    })
    // Ordered here rather than left to the query: the grid groups by area, and
    // a group whose members arrive in whatever order the planner produced would
    // reshuffle between loads and read as a change that did not happen.
    .sort(
      (a, b) =>
        a.practiceArea.position - b.practiceArea.position ||
        a.practiceArea.code.localeCompare(b.practiceArea.code) ||
        a.title.localeCompare(b.title),
    );

  return {
    items,
    // Facets carry no zeroes by construction — they are built from the services
    // that are actually there, so a value nothing sits behind cannot be offered.
    areas: [...areas.values()].sort(
      (a, b) => a.area.position - b.area.position || a.area.code.localeCompare(b.area.code),
    ),
    statuses: [...statuses.values()].sort((a, b) => a.status.localeCompare(b.status)),
    matchedBeforeFacets: all.length,
  };
}
