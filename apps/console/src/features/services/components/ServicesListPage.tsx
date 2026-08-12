import { Button, EmptyState, Spinner } from "@legal-ai/ui";
import { useCatalogue } from "../hooks/useCatalogue";
import { CatalogueFilters } from "./CatalogueFilters";
import { ServiceCards } from "./ServiceCards";
import { ServicesTable } from "./ServicesTable";

export function ServicesListPage() {
  const catalogue = useCatalogue();
  const { view, loading, error } = catalogue;

  // How many services the search would have found had the reader not narrowed
  // to an area. Only computed when nothing else is narrowing: the facets are
  // counted before the status filter, so quoting a number while a status is
  // also active would be quoting a bigger set than the reader would get.
  const matchesElsewhere =
    view !== null && catalogue.areas.length > 0 && catalogue.statuses.length === 0
      ? view.areas
          .filter((facet) => !catalogue.areas.includes(facet.area.code))
          .reduce((total, facet) => total + facet.count, 0)
      : 0;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="mt-1 text-sm text-inkSoft">
          Filter and search live in the address bar, so a narrowed catalogue is a link.
        </p>
      </div>

      {view !== null && (
        <CatalogueFilters catalogue={catalogue} areas={view.areas} statuses={view.statuses} />
      )}

      {error !== null && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-danger-ink">{error}</p>
          {/* The message says to try again, so there is something to try it
              with. `reload` existed and went unwired in the first version. */}
          <Button variant="secondary" onClick={catalogue.reload}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        // Spinner is aria-hidden by design, so the wrapper carries the
        // announcement — otherwise a screen reader hears nothing at all.
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <Spinner />
          <span className="sr-only">Loading services</span>
        </div>
      ) : error !== null ? (
        // An empty list after a failed load is not an empty catalogue. Telling
        // an admin to create their first service when the fetch simply broke is
        // worse than saying nothing.
        <EmptyState title="Could not load the catalogue" hint="Try again in a moment" />
      ) : view === null || view.matchedBeforeFacets === 0 ? (
        catalogue.filtered ? (
          <EmptyState
            title="Nothing matches"
            hint="No service matches this search. Clear the filters to see the whole catalogue."
            action={
              <Button variant="secondary" onClick={catalogue.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState title="No services yet" hint="Create the first one — it takes minutes" />
        )
      ) : view.items.length === 0 ? (
        // The catalogue has services; these filters exclude all of them. The
        // interesting case is a search that found something the reader cannot
        // see because of the area they picked — rendered as a plain empty
        // result, it says the firm has no such service, and the next thing they
        // do is build a second copy of one that already exists.
        <EmptyState
          title="Nothing matches these filters"
          hint={
            matchesElsewhere > 0
              ? `Nothing in the chosen area. ${matchesElsewhere} ${
                  matchesElsewhere === 1 ? "service matches" : "services match"
                } in other areas.`
              : "Clear the filters to see the whole catalogue."
          }
          action={
            <Button variant="secondary" onClick={catalogue.clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : catalogue.display === "table" ? (
        <ServicesTable services={view.items} />
      ) : (
        <ServiceCards services={view.items} grouped={catalogue.areas.length === 0} />
      )}
    </section>
  );
}
