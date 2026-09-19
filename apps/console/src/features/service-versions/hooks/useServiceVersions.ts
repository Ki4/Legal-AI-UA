// One service's versions, plus the acts that move them.
//
// One `act` and one error rather than one per operation: the six mutations are
// mutually exclusive on a screen — a person signs *or* sells *or* pauses, one
// dialog at a time — so a single "which act is running" and a single failure
// key cannot put the wrong sentence under the wrong button. `service-fields`
// keeps four errors because its four writes can be attempted independently;
// here they cannot.
//
// `notFound` is its own field, because a mistyped id and a broken request call
// for different reactions from the reader (DoD §4).

import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import {
  serviceVersionsApi,
  type LiftResolution,
  type PauseInput,
  type ServiceVersionsPage,
} from "../api";

export type ActKind =
  "submitForReview" | "returnToDraft" | "release" | "putOnSale" | "pause" | "lift";

export interface ServiceVersionsState {
  page: ServiceVersionsPage | null;
  loading: boolean;
  notFound: boolean;
  errorKey: TranslationKey | null;
  /** The act in flight, with the version (or pause) it is running on. */
  acting: { kind: ActKind; targetId: string } | null;
  actErrorKey: TranslationKey | null;
  submitForReview: (versionId: string) => Promise<boolean>;
  returnToDraft: (versionId: string) => Promise<boolean>;
  release: (versionId: string) => Promise<boolean>;
  putOnSale: (versionId: string) => Promise<boolean>;
  pause: (versionId: string, input: PauseInput) => Promise<boolean>;
  lift: (pauseId: string, resolution: LiftResolution) => Promise<boolean>;
  reload: () => void;
}

function loadErrorKey(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "versions.error.load";
  switch (cause.code) {
    case "forbidden":
      return "versions.error.forbidden";
    case "network":
      return "versions.error.network";
    default:
      return "versions.error.load";
  }
}

/**
 * `validation` is a guard's `raise exception` — the rule the database applied,
 * in English, for the stack. The reader gets our sentence for "the rule
 * refused", never that text (DoD §6).
 */
function actErrorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "versions.act.error.failed";
  switch (cause.code) {
    case "forbidden":
      return "versions.act.error.forbidden";
    case "validation":
      return "versions.act.error.refused";
    case "conflict":
      return "versions.act.error.conflict";
    case "network":
      return "versions.act.error.network";
    default:
      return "versions.act.error.failed";
  }
}

export function useServiceVersions(serviceId: string): ServiceVersionsState {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<ServiceVersionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [acting, setActing] = useState<ServiceVersionsState["acting"]>(null);
  const [actErrorKey, setActErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKey(null);
    setNotFound(false);

    serviceVersionsApi
      .listForService(serviceId)
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Cleared before the new outcome is shown: rows from the previous
        // service beside this one's error read as this one's answer (DoD §5).
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

  const run = useCallback(
    async (kind: ActKind, targetId: string, act: () => Promise<ServiceVersionsPage>) => {
      setActing({ kind, targetId });
      setActErrorKey(null);
      try {
        setPage(await act());
        return true;
      } catch (cause) {
        setActErrorKey(actErrorKeyFor(cause));
        return false;
      } finally {
        setActing(null);
      }
    },
    [],
  );

  return {
    page,
    loading,
    notFound,
    errorKey,
    acting,
    actErrorKey,
    submitForReview: useCallback(
      (id: string) => run("submitForReview", id, () => serviceVersionsApi.submitForReview(id)),
      [run],
    ),
    returnToDraft: useCallback(
      (id: string) => run("returnToDraft", id, () => serviceVersionsApi.returnToDraft(id)),
      [run],
    ),
    release: useCallback(
      (id: string) => run("release", id, () => serviceVersionsApi.release(id)),
      [run],
    ),
    putOnSale: useCallback(
      (id: string) => run("putOnSale", id, () => serviceVersionsApi.putOnSale(id)),
      [run],
    ),
    pause: useCallback(
      (id: string, input: PauseInput) =>
        run("pause", id, () => serviceVersionsApi.pause(id, input)),
      [run],
    ),
    lift: useCallback(
      (pauseId: string, resolution: LiftResolution) =>
        run("lift", pauseId, () => serviceVersionsApi.lift(pauseId, resolution)),
      [run],
    ),
    reload: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
