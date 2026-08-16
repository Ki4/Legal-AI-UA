// The register's state, kept out of the component for the reason the other
// screens keep theirs: the interesting part is which of several answers an empty
// array is, and that takes more state than a list looks like it should have.
//
// One thing is simpler here than on the orders list, and it is worth saying so
// nobody adds the missing branch back. `law_norms_select_staff` lets both staff
// roles read every norm, so there is no "none of these are yours" — an empty
// register is an empty register. What replaces it is the cadence edit, which is
// the first mutation any of these screens has carried.

import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import { lawApi, type CadenceChange, type LawNormListItem } from "../api";

export interface LawRegisterState {
  norms: LawNormListItem[] | null;
  loading: boolean;
  errorKey: TranslationKey | null;
  /** Which norm's cadence is being written, so one row's spinner is that row's. */
  savingNormId: string | null;
  /** Kept apart from `errorKey`: the list loaded, and the write is what failed. */
  saveErrorKey: TranslationKey | null;
  setCadence: (change: CadenceChange) => Promise<boolean>;
  reload: () => void;
}

function loadErrorKey(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "law.error.load";

  switch (cause.code) {
    case "forbidden":
      return "law.error.forbidden";
    case "network":
      return "law.error.network";
    default:
      return "law.error.load";
  }
}

/**
 * A failed write and a failed read do not share a sentence (DoD §6): a reader
 * told "could not load the register" after pressing Save learns nothing about
 * what they just did.
 */
function saveErrorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "law.cadence.error.save";

  switch (cause.code) {
    case "validation":
      return "law.cadence.error.validation";
    case "forbidden":
      return "law.cadence.error.forbidden";
    case "network":
      return "law.cadence.error.network";
    default:
      return "law.cadence.error.save";
  }
}

export function useLawRegister(): LawRegisterState {
  const [attempt, setAttempt] = useState(0);
  const [norms, setNorms] = useState<LawNormListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  // The key rather than the sentence, so switching language re-renders the
  // failure in the new one (DoD §6).
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [savingNormId, setSavingNormId] = useState<string | null>(null);
  const [saveErrorKey, setSaveErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKey(null);

    lawApi
      .listNorms()
      .then((result) => {
        if (!cancelled) setNorms(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Cleared, not kept (DoD §5): rows from the previous request rendered
        // beside a new failure read as this request's answer.
        setNorms(null);
        setErrorKey(loadErrorKey(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const setCadence = useCallback(async (change: CadenceChange) => {
    setSavingNormId(change.normId);
    setSaveErrorKey(null);

    try {
      const updated = await lawApi.setCadence(change);
      // The mutation returns the entity, so the row updates without a second
      // round trip (ADR-0012, convention 5).
      setNorms((current) =>
        current === null
          ? current
          : current.map((norm) => (norm.id === updated.id ? updated : norm)),
      );
      return true;
    } catch (cause: unknown) {
      setSaveErrorKey(saveErrorKeyFor(cause));
      return false;
    } finally {
      setSavingNormId(null);
    }
  }, []);

  return {
    norms,
    loading,
    errorKey,
    savingNormId,
    saveErrorKey,
    setCadence,
    reload: () => setAttempt((current) => current + 1),
  };
}
