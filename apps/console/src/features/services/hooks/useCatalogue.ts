// The catalogue's state, which lives in the URL rather than in this hook.
//
// That is the whole design (§4.1): a filtered catalogue is a link. The back
// button undoes a filter, a reload keeps it, and "look at this one" is a URL a
// lawyer can paste into a chat. State kept in `useState` here would give up all
// three for nothing.
//
// Components get data, loading and error from here and never see a promise, a
// fetch, or an AppError code they have to interpret twice.

import type { ServiceStatus } from "@legal-ai/db";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../../../app/auth";
import { AppError } from "../../../shared/api/errors";
import { servicesApi, type CatalogueFilter, type CatalogueView } from "../api";

export type Display = "cards" | "table";

const DISPLAY_KEY = "console.catalogue.display";
const SEARCH_DEBOUNCE_MS = 250;

// Every code gets its own sentence, and nothing falls through to
// `error.message` — those are written for whoever is reading a stack trace, not
// for a lawyer looking at a screen ("No profile with id usr-ghost.").
function messageFor(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.code) {
      case "forbidden":
        return "You do not have access to the service catalogue.";
      case "not_found":
        return "This catalogue no longer exists.";
      case "validation":
        return "The filter could not be applied. Try clearing it.";
      case "conflict":
        return "Someone changed this while you were looking. Reload to see the current state.";
      case "network":
        return "Could not reach the server. Check the connection and try again.";
      case "unknown":
        return "Something went wrong loading the catalogue.";
    }
  }
  return "Something went wrong loading the catalogue.";
}

const STATUSES: ServiceStatus[] = ["draft", "in_review", "published", "paused", "archived"];

function isStatus(value: string): value is ServiceStatus {
  return (STATUSES as string[]).includes(value);
}

/** A comma-separated parameter, with the empties dropped rather than kept as "". */
function listParam(raw: string | null): string[] {
  if (raw === null) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function storedDisplay(): Display {
  try {
    return window.localStorage.getItem(DISPLAY_KEY) === "table" ? "table" : "cards";
  } catch {
    // Private browsing, or storage disabled. A remembered preference is a
    // convenience; losing it must not cost the reader the screen.
    return "cards";
  }
}

export interface Catalogue {
  view: CatalogueView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;

  areas: string[];
  statuses: ServiceStatus[];
  /** What the reader has typed, which leads the URL by a moment. */
  query: string;
  mineOnly: boolean;
  display: Display;
  /** True when anything is narrowing the catalogue — what "clear" acts on. */
  filtered: boolean;

  toggleArea: (code: string) => void;
  toggleStatus: (status: ServiceStatus) => void;
  setQuery: (value: string) => void;
  setMineOnly: (value: boolean) => void;
  setDisplay: (value: Display) => void;
  clearFilters: () => void;
}

export function useCatalogue(): Catalogue {
  const [params, setParams] = useSearchParams();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [view, setView] = useState<CatalogueView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const areas = listParam(params.get("area"));
  const statuses = listParam(params.get("status")).filter(isStatus);
  const urlQuery = params.get("q") ?? "";
  const mineOnly = params.get("mine") === "1";

  const urlDisplay = params.get("view");
  const display: Display =
    urlDisplay === "table" ? "table" : urlDisplay === "cards" ? "cards" : storedDisplay();

  // The search box leads the URL: writing a parameter on every keystroke would
  // put a history entry behind each letter, and the back button is supposed to
  // undo a filter, not a character.
  const [typed, setTyped] = useState(urlQuery);
  const typedRef = useRef(typed);
  typedRef.current = typed;

  useEffect(() => {
    // The URL changed under us — a paste, a back button — and the box has to
    // follow. Guarded, or every debounce tick would fight the reader's typing.
    if (urlQuery !== typedRef.current) setTyped(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (typed === urlQuery) return;

    const timer = setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (typed === "") next.delete("q");
          else next.set("q", typed);
          return next;
        },
        // Replace: a search is refined letter by letter, and each refinement is
        // not a place the reader wants to come back to.
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [typed, urlQuery, setParams]);

  const filter = useMemo<CatalogueFilter>(() => {
    const next: CatalogueFilter = {};
    if (areas.length > 0) next.areas = areas;
    if (statuses.length > 0) next.status = statuses;
    if (urlQuery.trim() !== "") next.query = urlQuery;
    if (mineOnly && userId !== null) next.lawyerId = userId;
    return next;
    // Serialised: the arrays above are rebuilt on every render, so identity is
    // meaningless and their contents are what the effect actually depends on.
  }, [areas.join(","), statuses.join(","), urlQuery, mineOnly, userId]);

  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    servicesApi
      .browse(JSON.parse(filterKey) as CatalogueFilter)
      .then((result) => {
        if (!cancelled) setView(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(messageFor(cause));
        // Drop the previous result too. It belongs to the previous filter, and
        // leaving it on screen next to an error reads as "here are your
        // results" when they are somebody else's.
        setView(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterKey, reloadToken]);

  const toggle = useCallback(
    (key: string, value: string) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        const active = listParam(next.get(key));
        const after = active.includes(value)
          ? active.filter((entry) => entry !== value)
          : [...active, value];

        if (after.length === 0) next.delete(key);
        else next.set(key, after.join(","));
        return next;
      });
    },
    [setParams],
  );

  const toggleArea = useCallback((code: string) => toggle("area", code), [toggle]);
  const toggleStatus = useCallback((status: ServiceStatus) => toggle("status", status), [toggle]);

  const setMineOnly = useCallback(
    (value: boolean) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set("mine", "1");
        else next.delete("mine");
        return next;
      });
    },
    [setParams],
  );

  const setDisplay = useCallback(
    (value: Display) => {
      try {
        window.localStorage.setItem(DISPLAY_KEY, value);
      } catch {
        // See storedDisplay: remembering is a convenience, not a requirement.
      }
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("view", value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setTyped("");
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ["area", "status", "q", "mine"]) next.delete(key);
      return next;
    });
  }, [setParams]);

  return {
    view,
    loading,
    error,
    reload,
    areas,
    statuses,
    query: typed,
    mineOnly,
    display,
    filtered: areas.length > 0 || statuses.length > 0 || urlQuery.trim() !== "" || mineOnly,
    toggleArea,
    toggleStatus,
    setQuery: setTyped,
    setMineOnly,
    setDisplay,
    clearFilters,
  };
}
