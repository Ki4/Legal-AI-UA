// The trace's loading and error state, kept out of the component for the
// reason `useCatalogue`'s header states: "Components get data, loading and
// error from here and never see a promise, a fetch, or an AppError code they
// have to interpret twice." `AnatomyPage` used to render synchronously from a
// fixture and could neither wait nor fail; going through `anatomyApi` means
// it can do both, and a component that awaits the promise itself renders
// "nothing" for three different reasons — loading, no blocks, and failed —
// that a reader cannot tell apart. This hook keeps them apart instead.
//
// No dictionary key for the failure sentence: anatomy's text stays hardcoded
// (apps/console/CLAUDE.md — this feature is fixture content, not interface
// copy), so a fixed string, not `error.message`, is what the component gets.

import { useEffect, useState } from "react";
import { anatomyApi, type GenerationTraceView } from "../api";

export interface Trace {
  trace: GenerationTraceView | null;
  loading: boolean;
  error: string | null;
}

const FAILURE_MESSAGE = "Could not load the generation trace. Try again in a moment.";

export function useTrace(serviceId: string | undefined): Trace {
  const [trace, setTrace] = useState<GenerationTraceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    anatomyApi
      .getTrace(serviceId ?? "")
      .then((result) => {
        if (!cancelled) setTrace(result);
      })
      .catch(() => {
        if (cancelled) return;
        // The code is not rendered — see the file header — only that
        // something failed. `AppError` and its `code` are the layer's
        // business; the screen has one sentence for every reason this can
        // reject.
        setError(FAILURE_MESSAGE);
        setTrace(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  return { trace, loading, error };
}
