// One order's state. Simpler than the list's, and the difference is worth
// naming: on the list, an empty result is ambiguous and the screen has to ask a
// second question to resolve it. Here the reader named a specific order, so
// "not found" and "not yours" are answered with the same sentence on purpose —
// confirming that a named record exists is itself a leak (§7.3).

import { useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import { ordersApi, type OrderCard } from "../api";

export interface OrderCardState {
  order: OrderCard | null;
  loading: boolean;
  errorKey: TranslationKey | null;
  /** True when trying again could plausibly help. A mistyped id is not. */
  retryable: boolean;
  reload: () => void;
}

function errorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "order.error.load";

  switch (cause.code) {
    case "not_found":
      return "order.error.notFound";
    case "forbidden":
      return "order.error.forbidden";
    case "network":
      return "order.error.network";
    default:
      return "order.error.load";
  }
}

export function useOrderCard(orderId: string | undefined): OrderCardState {
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<OrderCard | null>(null);
  const [loading, setLoading] = useState(true);
  // The key rather than the sentence, so switching language re-renders the
  // failure in the new one instead of leaving it in whichever was active when
  // the request failed (DoD §6).
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    // `loading` starts true, so bailing out without clearing it would leave the
    // page on a spinner forever. Unreachable while the route supplies the
    // param, which is exactly why it would go unnoticed if it ever were not.
    if (orderId === undefined) {
      setLoading(false);
      setErrorKey("order.error.noneSelected");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorKey(null);

    ordersApi
      .get(orderId)
      .then((result) => {
        if (cancelled) return;
        setOrder(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Cleared, not kept (DoD §5): a previous order rendered next to a new
        // failure reads as this request's answer.
        setOrder(null);
        setErrorKey(errorKeyFor(cause));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  return {
    order,
    loading,
    errorKey,
    retryable: errorKey !== "order.error.notFound" && errorKey !== "order.error.noneSelected",
    reload: () => setAttempt((current) => current + 1),
  };
}
