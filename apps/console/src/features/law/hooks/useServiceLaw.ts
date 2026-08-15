// One service's law dependencies, plus the two writes that maintain them.
//
// `notFound` is its own field rather than an error key, because a mistyped id
// and a broken request call for different reactions from the reader and DoD §4
// asks the screen to distinguish them. A service that exists and has no
// references is neither: that is the empty state, and it is what every service
// looks like today.

import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import { lawApi, type NewLawReference, type ServiceLawPage } from "../api";

export interface ServiceLawState {
  page: ServiceLawPage | null;
  loading: boolean;
  notFound: boolean;
  errorKey: TranslationKey | null;
  adding: boolean;
  addErrorKey: TranslationKey | null;
  removingId: string | null;
  removeErrorKey: TranslationKey | null;
  addReference: (input: NewLawReference) => Promise<boolean>;
  removeReference: (refId: string) => Promise<void>;
  reload: () => void;
}

function loadErrorKey(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "serviceLaw.error.load";

  switch (cause.code) {
    case "forbidden":
      return "serviceLaw.error.forbidden";
    case "network":
      return "serviceLaw.error.network";
    default:
      return "serviceLaw.error.load";
  }
}

function addErrorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "serviceLaw.add.error.save";

  switch (cause.code) {
    case "validation":
      return "serviceLaw.add.error.validation";
    case "conflict":
      return "serviceLaw.add.error.conflict";
    case "forbidden":
      return "serviceLaw.add.error.forbidden";
    case "network":
      return "serviceLaw.add.error.network";
    default:
      return "serviceLaw.add.error.save";
  }
}

export function useServiceLaw(serviceId: string): ServiceLawState {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<ServiceLawPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [adding, setAdding] = useState(false);
  const [addErrorKey, setAddErrorKey] = useState<TranslationKey | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeErrorKey, setRemoveErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKey(null);
    setNotFound(false);

    lawApi
      .listForService(serviceId)
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setPage(null);
        if (cause instanceof AppError && cause.code === "not_found") {
          setNotFound(true);
          return;
        }
        setErrorKey(loadErrorKey(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, attempt]);

  const addReference = useCallback(async (input: NewLawReference) => {
    setAdding(true);
    setAddErrorKey(null);

    try {
      const ref = await lawApi.addReference(input);
      setPage((current) =>
        current === null ? current : { ...current, refs: [...current.refs, ref] },
      );
      return true;
    } catch (cause: unknown) {
      setAddErrorKey(addErrorKeyFor(cause));
      return false;
    } finally {
      setAdding(false);
    }
  }, []);

  const removeReference = useCallback(async (refId: string) => {
    setRemovingId(refId);
    setRemoveErrorKey(null);

    try {
      const removed = await lawApi.removeReference(refId);
      // Dropped only after the write is known to have happened. A row removed
      // optimistically and put back by the next load reads as a bug rather than
      // as the refusal it is — which is the whole reason `removeReference`
      // returns an id instead of void (DoD §3).
      setPage((current) =>
        current === null
          ? current
          : { ...current, refs: current.refs.filter((ref) => ref.id !== removed) },
      );
    } catch (cause: unknown) {
      setRemoveErrorKey(
        cause instanceof AppError && cause.code === "forbidden"
          ? "serviceLaw.remove.forbidden"
          : "serviceLaw.remove.error",
      );
    } finally {
      setRemovingId(null);
    }
  }, []);

  return {
    page,
    loading,
    notFound,
    errorKey,
    adding,
    addErrorKey,
    removingId,
    removeErrorKey,
    addReference,
    removeReference,
    reload: () => setAttempt((current) => current + 1),
  };
}
