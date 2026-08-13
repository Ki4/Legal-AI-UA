import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner } from "@legal-ai/ui";
import { useCatalogue } from "../hooks/useCatalogue";
import { CatalogueFilters } from "./CatalogueFilters";
import { ServiceCards } from "./ServiceCards";
import { ServicesTable } from "./ServicesTable";

export function ServicesListPage() {
  const { t, tCount } = useI18n();
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
        <h1 className="text-2xl font-semibold">{t("catalogue.title")}</h1>
        <p className="mt-1 text-sm text-inkSoft">{t("catalogue.subtitle")}</p>
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
            {t("common.tryAgain")}
          </Button>
        </div>
      )}

      {loading ? (
        // Spinner is aria-hidden by design, so the wrapper carries the
        // announcement — otherwise a screen reader hears nothing at all.
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <Spinner />
          <span className="sr-only">{t("catalogue.loading")}</span>
        </div>
      ) : error !== null ? (
        // An empty list after a failed load is not an empty catalogue. Telling
        // an admin to create their first service when the fetch simply broke is
        // worse than saying nothing.
        <EmptyState title={t("catalogue.failed.title")} hint={t("catalogue.failed.hint")} />
      ) : view === null || view.matchedBeforeFacets === 0 ? (
        catalogue.filtered ? (
          <EmptyState
            title={t("catalogue.empty.search.title")}
            hint={t("catalogue.empty.search.hint")}
            action={
              <Button variant="secondary" onClick={catalogue.clearFilters}>
                {t("catalogue.filter.clear")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t("catalogue.empty.none.title")}
            hint={t("catalogue.empty.none.hint")}
          />
        )
      ) : view.items.length === 0 ? (
        // The catalogue has services; these filters exclude all of them. The
        // interesting case is a search that found something the reader cannot
        // see because of the area they picked — rendered as a plain empty
        // result, it says the firm has no such service, and the next thing they
        // do is build a second copy of one that already exists.
        <EmptyState
          title={t("catalogue.empty.filters.title")}
          hint={
            matchesElsewhere > 0
              ? // Two sentences rather than one with a number inside it: only
                // the second one counts, and only it needs the plural forms
                // Ukrainian has three of. A single template would drag the
                // first sentence through `tCount` for no reason.
                `${t("catalogue.empty.filters.elsewhere")} ${tCount(
                  "catalogue.matchesElsewhere",
                  matchesElsewhere,
                )}`
              : t("catalogue.empty.filters.hint")
          }
          action={
            <Button variant="secondary" onClick={catalogue.clearFilters}>
              {t("catalogue.filter.clear")}
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
