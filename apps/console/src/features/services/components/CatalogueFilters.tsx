// The filter bar.
//
// Chips rather than dropdowns, and not as a compromise: `packages/ui` has no
// Select yet, and a local one-off is what DoD §6 forbids. With the counts on
// them, chips also say more than a closed dropdown can — you can see the shape
// of the catalogue without opening anything.
//
// Every value here comes from the facets, which are built from services that
// exist. A chip that leads nowhere is therefore not something this component
// has to guard against: it cannot be rendered.

import { Badge, Button, Input } from "@legal-ai/ui";
import type { AreaFacet, StatusFacet } from "../api";
import type { Catalogue } from "../hooks/useCatalogue";

interface ChipProps {
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}

function Chip({ label, count, active, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`rounded-btn border px-2.5 py-1 text-sm transition-colors motion-safe:duration-[--motion-fast] ${
        active
          ? "border-brand bg-brand text-paper"
          : "border-line bg-paper text-ink hover:border-lineStrong"
      }`}
    >
      {label} <span className={active ? "opacity-80" : "text-inkMute"}>{count}</span>
    </button>
  );
}

interface Props {
  catalogue: Catalogue;
  areas: AreaFacet[];
  statuses: StatusFacet[];
}

export function CatalogueFilters({ catalogue, areas, statuses }: Props) {
  return (
    <div className="space-y-3 rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            value={catalogue.query}
            placeholder="Search title, slug or summary"
            aria-label="Search services"
            onChange={(event) => catalogue.setQuery(event.target.value)}
          />
        </div>

        <div className="flex gap-1" role="group" aria-label="How the catalogue is shown">
          <Button
            variant={catalogue.display === "cards" ? "secondary" : "ghost"}
            aria-pressed={catalogue.display === "cards"}
            onClick={() => catalogue.setDisplay("cards")}
          >
            Cards
          </Button>
          <Button
            variant={catalogue.display === "table" ? "secondary" : "ghost"}
            aria-pressed={catalogue.display === "table"}
            onClick={() => catalogue.setDisplay("table")}
          >
            Table
          </Button>
        </div>
      </div>

      {areas.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm text-inkSoft">Practice area</span>
          {areas.map((facet) => (
            <Chip
              key={facet.area.code}
              label={facet.area.label}
              count={facet.count}
              active={catalogue.areas.includes(facet.area.code)}
              onToggle={() => catalogue.toggleArea(facet.area.code)}
            />
          ))}
        </div>
      )}

      {statuses.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm text-inkSoft">Status</span>
          {statuses.map((facet) => (
            <Chip
              key={facet.status}
              label={facet.status}
              count={facet.count}
              active={catalogue.statuses.includes(facet.status)}
              onToggle={() => catalogue.toggleStatus(facet.status)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {/* A native checkbox: the design system's own is item 1 of its wave,
              and this is the one control that cannot be a chip — it is not a
              value with a count, it is a question about the reader. */}
          <input
            type="checkbox"
            checked={catalogue.mineOnly}
            onChange={(event) => catalogue.setMineOnly(event.target.checked)}
            className="size-4 rounded-btn border-line accent-brand"
          />
          Only services I am attached to
        </label>

        {catalogue.filtered && (
          <>
            <Badge tone="brand">filtered</Badge>
            <Button variant="ghost" onClick={catalogue.clearFilters}>
              Clear filters
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
