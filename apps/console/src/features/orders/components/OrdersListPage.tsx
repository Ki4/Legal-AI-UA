import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner } from "@legal-ai/ui";
import { useOrders } from "../hooks/useOrders";
import { OrdersTable } from "./OrdersTable";

export function OrdersListPage() {
  const { t, tCount } = useI18n();
  const { page, loading, loadingMore, errorKey, restricted, showMore, reload } = useOrders();

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("orders.loading")}</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("orders.title")}</h1>
        {/* Said once, at the top, rather than implied by the absence of names.
            A reader who does not know the schema cannot tell a depersonalised
            screen from an incomplete one, and §7.3 asks for the first. */}
        <p className="mt-1 text-sm text-inkSoft">{t("orders.subtitle")}</p>
      </div>

      {errorKey !== null ? (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-danger-ink">{t(errorKey)}</p>
            <Button variant="secondary" onClick={reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
          {/* An empty list after a failed load is not an empty list. Telling a
              lawyer there are no orders when the request simply broke is the
              mistake DoD §4 names as the most repeatable one here, and this
              screen has exactly the shape that made it. */}
          <EmptyState title={t("orders.failed.title")} hint={t("orders.failed.hint")} />
        </>
      ) : restricted ? (
        // Nothing failed. `orders_select_staff` did what it says: a lawyer reads
        // the orders of services they are attached to, and this one is attached
        // to none. Rendered as an empty list it would claim the firm has no
        // clients.
        <EmptyState title={t("orders.restricted.title")} hint={t("orders.restricted.hint")} />
      ) : page === null || page.orders.length === 0 ? (
        // The expected state of a working system today: nothing writes orders
        // until the gateway does (ADM-5), which is what the hint says rather
        // than inviting anybody to create one here.
        <EmptyState title={t("orders.empty.title")} hint={t("orders.empty.hint")} />
      ) : (
        <>
          <OrdersTable orders={page.orders} />

          <div className="flex items-center gap-3">
            <p className="text-sm text-inkSoft">{tCount("orders.shown", page.orders.length)}</p>
            {page.hasMore && (
              <Button variant="secondary" onClick={showMore} disabled={loadingMore}>
                {t(loadingMore ? "orders.loadingMore" : "orders.showMore")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
