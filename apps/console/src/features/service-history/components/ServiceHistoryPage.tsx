import { useI18n } from "@legal-ai/i18n";
import { Button, EmptyState, Spinner } from "@legal-ai/ui";
import { Link, useParams } from "react-router";
import { useServiceHistory } from "../hooks/useServiceHistory";
import { HistoryTable } from "./HistoryTable";

export function ServiceHistoryPage() {
  const { serviceId } = useParams();
  const { t, tCount } = useI18n();
  const { page, loading, loadingMore, errorKey, retryable, restricted, showMore, reload } =
    useServiceHistory(serviceId);

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <Spinner />
        <span className="sr-only">{t("history.loading")}</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("history.title")}</h1>
        {page !== null && (
          <p className="mt-1 text-sm text-inkSoft">
            <Link to={`/services/${page.serviceId}`} className="text-brand hover:underline">
              {page.serviceTitle}
            </Link>
          </p>
        )}
      </div>

      {errorKey !== null ? (
        retryable ? (
          <>
            <div className="flex items-center gap-3">
              <p className="text-sm text-danger-ink">{t(errorKey)}</p>
              <Button variant="secondary" onClick={reload}>
                {t("common.tryAgain")}
              </Button>
            </div>
            {/* An empty log after a failed load is not an empty log. Telling an
                admin that nothing has ever happened to a service when the
                request simply broke is the mistake §4.1 names, and this screen
                has the same shape as the one that made it. */}
            <EmptyState title={t("history.failed.title")} hint={t("history.failed.hint")} />
          </>
        ) : (
          // A service that does not exist is not a request that failed, and it
          // gets its own sentence rather than borrowing the one above (DoD §6).
          // The borrowed one ended "Try again" beside no button to try it with,
          // which is the sort of thing only a running screen shows you.
          <EmptyState title={t(errorKey)} hint={t("history.gone.hint")} />
        )
      ) : restricted ? (
        // Nothing failed. The policy did what it says: a lawyer reads the
        // history of the services they are attached to, and this is not one of
        // them. Rendered as an empty log it would claim a colleague's service
        // has never been touched.
        <EmptyState title={t("history.restricted.title")} hint={t("history.restricted.hint")} />
      ) : page === null || page.events.length === 0 ? (
        <EmptyState title={t("history.empty.title")} hint={t("history.empty.hint")} />
      ) : (
        <>
          <HistoryTable events={page.events} />

          <div className="flex items-center gap-3">
            <p className="text-sm text-inkSoft">{tCount("history.shown", page.events.length)}</p>
            {page.hasMore && (
              <Button variant="secondary" onClick={showMore} disabled={loadingMore}>
                {t(loadingMore ? "history.loadingMore" : "history.showMore")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
