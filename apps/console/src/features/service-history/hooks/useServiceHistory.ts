// The screen's state, kept out of the component because there is more of it
// than a history screen looks like it should have — and all of it for one
// reason: RLS answers "you may not see this" and "there is nothing to see"
// with the same empty array.

import { useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { useAuth } from "../../../app/auth";
import { AppError } from "../../../shared/api/errors";
import { serviceHistoryApi, type ServiceHistoryPage } from "../api";

/**
 * How many events a first look holds. Chosen to be more than a service
 * accumulates in a normal month and small enough that the query stays cheap;
 * "show more" adds another page rather than paginating, because a log is read
 * downwards and a reader who has scrolled to the bottom wants the next stretch,
 * not a different page they have to keep their place in.
 */
export const HISTORY_PAGE = 50;

export interface ServiceHistoryState {
  page: ServiceHistoryPage | null;
  /** The first load for this service. `loadingMore` covers every later one. */
  loading: boolean;
  loadingMore: boolean;
  errorKey: TranslationKey | null;
  /** True when the error is worth offering a retry for. A mistyped id is not. */
  retryable: boolean;
  /**
   * The caller is a lawyer who is not attached to this service, so the empty
   * result is RLS and not an empty log. Kept apart from `errorKey` because
   * nothing failed — the request did exactly what the policy says it should.
   */
  restricted: boolean;
  showMore: () => void;
  reload: () => void;
}

function errorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "history.error.load";

  switch (cause.code) {
    case "not_found":
      return "history.error.notFound";
    case "forbidden":
      return "history.error.forbidden";
    case "network":
      return "history.error.network";
    default:
      return "history.error.load";
  }
}

export function useServiceHistory(serviceId: string | undefined): ServiceHistoryState {
  const { role } = useAuth();
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<ServiceHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // The key rather than the sentence, so switching language re-renders the
  // failure in the new one instead of leaving it in whichever was active when
  // the request failed (DoD §6).
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    // `loading` starts true, so bailing out without clearing it would leave the
    // page on a spinner forever. Unreachable while the route supplies the
    // param, which is exactly why it would go unnoticed if it ever were not.
    if (serviceId === undefined) {
      setLoading(false);
      setErrorKey("history.error.noneSelected");
      return;
    }

    let cancelled = false;
    // A wider limit is a second look at a list already on screen, and blanking
    // it to a spinner loses the reader's place. A first look has nothing to
    // lose and everything to announce.
    const first = limit === HISTORY_PAGE;
    if (first) setLoading(true);
    else setLoadingMore(true);
    setErrorKey(null);

    serviceHistoryApi
      .get(serviceId, limit)
      .then(async (result) => {
        if (cancelled) return;
        setPage(result);

        // Only asked when it can change what the screen says. An admin reads
        // every service's events without being attached to anything, and a
        // non-empty result has already proved the caller may read.
        if (result.events.length > 0 || role !== "lawyer") {
          setRestricted(false);
          return;
        }

        const attached = await serviceHistoryApi.isAttached(serviceId);
        if (!cancelled) setRestricted(!attached);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Cleared, not kept (DoD §5): rows from the previous request rendered
        // next to a new failure read as this request's answer.
        setPage(null);
        setRestricted(false);
        setErrorKey(errorKeyFor(cause));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, limit, attempt, role]);

  return {
    page,
    loading,
    loadingMore,
    errorKey,
    retryable: errorKey !== "history.error.notFound" && errorKey !== "history.error.noneSelected",
    restricted,
    showMore: () => setLimit((current) => current + HISTORY_PAGE),
    reload: () => setAttempt((current) => current + 1),
  };
}
