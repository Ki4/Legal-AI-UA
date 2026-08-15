// The screen's state, kept out of the component for the same reason the service
// history keeps its own: RLS answers "you may not see these" and "there are
// none" with the same empty array, and telling them apart takes more state than
// a list looks like it should have.
//
// One thing is different here, and it matters. On the history screen an empty
// result is unusual. On this one it is the expected state of a working system:
// nothing writes orders until the gateway does (ADM-5). So the ambiguity runs
// the other way — the reader most likely to be misled is the lawyer who is
// attached to nothing and is told the firm has no clients.

import { useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { useAuth } from "../../../app/auth";
import { AppError } from "../../../shared/api/errors";
import { ordersApi, type OrdersPage } from "../api";

/**
 * How many orders a first look holds. Larger than the history's page because a
 * row here is one line rather than a change record, and because the list is
 * read as a queue: a reader is looking for the oldest thing still open, which
 * is at the bottom.
 */
export const ORDERS_PAGE = 50;

export interface OrdersState {
  page: OrdersPage | null;
  /** The first load. `loadingMore` covers every later one. */
  loading: boolean;
  loadingMore: boolean;
  errorKey: TranslationKey | null;
  /**
   * The caller is a lawyer attached to no service, so an empty list is the
   * policy and not an empty platform. Kept apart from `errorKey` because
   * nothing failed — the request did exactly what `orders_select_staff` says.
   */
  restricted: boolean;
  showMore: () => void;
  reload: () => void;
}

function errorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "orders.error.load";

  switch (cause.code) {
    case "forbidden":
      return "orders.error.forbidden";
    case "network":
      return "orders.error.network";
    default:
      return "orders.error.load";
  }
}

export function useOrders(): OrdersState {
  const { role } = useAuth();
  const [limit, setLimit] = useState(ORDERS_PAGE);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<OrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // The key rather than the sentence, so switching language re-renders the
  // failure in the new one instead of leaving it in whichever was active when
  // the request failed (DoD §6).
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A wider limit is a second look at a list already on screen, and blanking
    // it to a spinner loses the reader's place.
    const first = limit === ORDERS_PAGE;
    if (first) setLoading(true);
    else setLoadingMore(true);
    setErrorKey(null);

    ordersApi
      .list(limit)
      .then(async (result) => {
        if (cancelled) return;
        setPage(result);

        // Only asked when it can change what the screen says. An admin reads
        // every order without being attached to anything, and a non-empty
        // result has already proved the caller may read.
        if (result.orders.length > 0 || role !== "lawyer") {
          setRestricted(false);
          return;
        }

        const attached = await ordersApi.hasAnyAssignment();
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
  }, [limit, attempt, role]);

  return {
    page,
    loading,
    loadingMore,
    errorKey,
    restricted,
    showMore: () => setLimit((current) => current + ORDERS_PAGE),
    reload: () => setAttempt((current) => current + 1),
  };
}
