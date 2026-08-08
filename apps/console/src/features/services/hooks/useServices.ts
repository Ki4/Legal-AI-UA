// Feature-local hook. Components get data, loading and error from here and
// never see a promise, a fetch, or an AppError code they have to interpret
// twice.

import { useCallback, useEffect, useState } from "react";
import { AppError } from "../../../shared/api/errors";
import { servicesApi, type ServiceFilter, type ServiceListItem } from "../api";

interface ServicesState {
  services: ServiceListItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.code) {
      case "forbidden":
        return "You do not have access to the service catalogue.";
      case "network":
        return "Could not reach the server. Check the connection and try again.";
      default:
        return error.message;
    }
  }
  return "Something went wrong loading the catalogue.";
}

export function useServices(filter?: ServiceFilter): ServicesState {
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  // Serialised so a caller passing an inline object literal does not retrigger
  // the effect on every render. The effect reads `filter` from the closure and
  // depends on the serialisation of it: any change to the filter's contents
  // changes the key, which re-runs the effect with a fresh closure.
  const filterKey = JSON.stringify(filter ?? null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    servicesApi
      .list(filter)
      .then((result) => {
        if (!cancelled) setServices(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(messageFor(cause));
        // Drop the previous result too. It belongs to the previous filter, and
        // leaving it on screen next to an error reads as "here are your
        // results" when they are somebody else's.
        setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterKey, reloadToken]);

  return { services, loading, error, reload };
}
