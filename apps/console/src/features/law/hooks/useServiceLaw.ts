// One service's law dependencies, plus the two writes that maintain them.
//
// `notFound` is its own field rather than an error key, because a mistyped id
// and a broken request call for different reactions from the reader and DoD §4
// asks the screen to distinguish them. A service that exists and has no
// references is neither: that is the empty state, and it is what every service
// looks like today.

import { useCallback, useEffect, useState } from "react";
import type { ArticleReading, ArticleFailure } from "@legal-ai/law-refs";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import { lawApi, type NewLawReference, type ServiceLawPage } from "../api";

/**
 * What a check of the source produced, for the screen to render.
 *
 * A reading and a failure are both answers — the source responded either way —
 * so they are one result rather than a value and a thrown error. `errorKey` is
 * the third case and a different kind: the call itself did not happen.
 */
export type ArticleCheck =
  { kind: "read"; reading: ArticleReading } | { kind: "refused"; failure: ArticleFailure };

/**
 * What became of the norm after it was saved (§9.11).
 *
 * `confirmed` is the ordinary path: the text a lawyer read is still the text the
 * register holds. The other two are worth their own sentences — `moved` is the
 * article having changed between the check and the save, and `unreachable` is
 * the fetch having failed on the second look, which §9.10 refuses to render as
 * an ordinary save.
 */
export type AddOutcome = "confirmed" | "moved" | "unreachable";

export interface ServiceLawState {
  page: ServiceLawPage | null;
  loading: boolean;
  notFound: boolean;
  errorKey: TranslationKey | null;
  adding: boolean;
  addErrorKey: TranslationKey | null;
  checking: boolean;
  check: ArticleCheck | null;
  checkErrorKey: TranslationKey | null;
  addOutcome: AddOutcome | null;
  removingId: string | null;
  removeErrorKey: TranslationKey | null;
  checkArticle: (url: string, article: string) => Promise<void>;
  addReference: (input: NewLawReference, confirmedFingerprint?: string) => Promise<boolean>;
  removeReference: (refId: string) => Promise<void>;
  reload: () => void;
}

/**
 * The observation that follows a save, and what it means for the screen.
 *
 * Kept out of `addReference` because the reference *is* recorded whatever this
 * returns: a fetch that fails on the second look leaves a saved norm marked
 * `unreachable`, which is a sentence to read rather than a failed save to
 * retry. Folding it into the catch above would have turned a recorded
 * dependency into an error message, and the lawyer would enter it twice.
 */
async function observe(
  normId: string,
  confirmedFingerprint: string,
): Promise<{ outcome: AddOutcome; state: ServiceLawPage["refs"][number]["norm"]["state"] } | null> {
  try {
    const result = await lawApi.observeArticle({ normId, confirmedFingerprint });

    if (!result.ok) return { outcome: "unreachable", state: result.state };
    return { outcome: result.confirmed ? "confirmed" : "moved", state: result.state };
  } catch {
    // The norm is saved and unconfirmed, which is exactly what `unverified`
    // means; the register will show it as never checked until something checks
    // it. Saying nothing here would be the one thing §9.10 refuses.
    return { outcome: "unreachable", state: "unverified" };
  }
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
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<ArticleCheck | null>(null);
  const [checkErrorKey, setCheckErrorKey] = useState<TranslationKey | null>(null);
  const [addOutcome, setAddOutcome] = useState<AddOutcome | null>(null);
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

  /**
   * Read the article back before anything is written (§9.6).
   *
   * A refusal from the source is a result and not an error — the form has a
   * sentence for each one — so only a call that did not complete sets
   * `checkErrorKey`.
   */
  const checkArticle = useCallback(async (url: string, article: string) => {
    setChecking(true);
    setCheck(null);
    setCheckErrorKey(null);
    setAddOutcome(null);

    try {
      const result = await lawApi.previewArticle({ url, article });
      setCheck(
        result.ok
          ? { kind: "read", reading: result.reading }
          : { kind: "refused", failure: result.failure },
      );
    } catch (cause: unknown) {
      setCheckErrorKey(
        cause instanceof AppError && cause.code === "forbidden"
          ? "serviceLaw.check.forbidden"
          : "serviceLaw.check.error",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  const addReference = useCallback(
    async (input: NewLawReference, confirmedFingerprint?: string) => {
      setAdding(true);
      setAddErrorKey(null);
      setAddOutcome(null);

      try {
        const ref = await lawApi.addReference(input);
        // The observation runs against the saved row, and it is the only thing
        // that can record a revision or move `last_verified_at` — those columns
        // are withheld from the console's own grant on purpose (§9.10). The
        // fingerprint carried in is the one the lawyer actually read.
        const observed =
          confirmedFingerprint === undefined
            ? null
            : await observe(ref.norm.id, confirmedFingerprint);

        setPage((current) =>
          current === null
            ? current
            : {
                ...current,
                refs: [
                  ...current.refs,
                  observed === null
                    ? ref
                    : { ...ref, norm: { ...ref.norm, state: observed.state } },
                ],
              },
        );

        setCheck(null);
        setAddOutcome(observed?.outcome ?? null);
        return true;
      } catch (cause: unknown) {
        setAddErrorKey(addErrorKeyFor(cause));
        return false;
      } finally {
        setAdding(false);
      }
    },
    [],
  );

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
    checking,
    check,
    checkErrorKey,
    addOutcome,
    removingId,
    removeErrorKey,
    checkArticle,
    addReference,
    removeReference,
    reload: () => setAttempt((current) => current + 1),
  };
}
