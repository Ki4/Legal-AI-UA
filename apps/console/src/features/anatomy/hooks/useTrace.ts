// The trace's loading and error state, kept out of the component for the
// reason `useCatalogue`'s header states: "Components get data, loading and
// error from here and never see a promise, a fetch, or an AppError code they
// have to interpret twice." `AnatomyPage` used to render synchronously from a
// fixture and could neither wait nor fail; going through `anatomyApi` means
// it can do both, and a component that awaits the promise itself renders
// "nothing" for three different reasons — loading, no blocks, and failed —
// that a reader cannot tell apart. This hook keeps them apart instead.
//
// The failure leaves here as a `TranslationKey`, not as a sentence. A string
// translated at catch time is frozen in whichever language was active then, so
// a reader who switches while it is on screen keeps reading the old one
// (`apps/console/CLAUDE.md`, "Copy: dictionary keys only"; DoD §6). Which
// sentence belongs to which failure is decided here; which language it is in is
// decided by whoever renders it.

import type { TranslationKey } from "@legal-ai/i18n";
import { useEffect, useState } from "react";
import { AppError } from "../../../shared/api/errors";
import { anatomyApi, type GenerationTraceView } from "../api";

export interface Trace {
  trace: GenerationTraceView | null;
  loading: boolean;
  errorKey: TranslationKey | null;
}

// Every code gets its own sentence, and nothing falls through to
// `error.message` — those are written for whoever is reading a stack trace, not
// for a lawyer looking at a screen, and they are written in English whatever
// the reader chose.
function messageKeyFor(error: unknown): TranslationKey {
  if (error instanceof AppError) {
    switch (error.code) {
      case "forbidden":
        return "anatomy.error.forbidden";
      case "not_found":
        return "anatomy.error.notFound";
      case "validation":
        return "anatomy.error.validation";
      case "conflict":
        return "anatomy.error.conflict";
      case "network":
        return "anatomy.error.network";
      case "unknown":
        return "anatomy.error.unknown";
    }
  }
  return "anatomy.error.unknown";
}

export function useTrace(serviceId: string | undefined): Trace {
  const [trace, setTrace] = useState<GenerationTraceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKey(null);

    anatomyApi
      .getTrace(serviceId ?? "")
      .then((result) => {
        if (!cancelled) setTrace(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorKey(messageKeyFor(error));
        setTrace(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  return { trace, loading, errorKey };
}
