// Translating Postgres failures into the small closed set of AppError codes
// (ADR-0012, conventions 3 and 4). Nothing Supabase-shaped may cross an api/
// boundary, so every implementation funnels its errors through here.

import type { PostgrestError } from "@supabase/supabase-js";
import { AppError } from "./errors";

/**
 * Codes worth distinguishing. Everything else is `unknown` on purpose: a code
 * mapped by guesswork produces a confident wrong message, which is harder to
 * debug than an honest one.
 */
export function fromPostgrest(error: PostgrestError, what: string): AppError {
  switch (error.code) {
    case "42501": // insufficient_privilege — RLS WITH CHECK, or a missing grant
      return new AppError("forbidden", `${what}: not permitted.`, { cause: error });
    case "PGRST116": // .single() matched no rows
      return new AppError("not_found", `${what}: no such record.`, { cause: error });
    case "23505": // unique_violation
      return new AppError("conflict", `${what}: that value is already taken.`, { cause: error });
    case "23503": // foreign_key_violation
    case "23514": // check_violation
      return new AppError("validation", `${what}: ${error.message}`, { cause: error });
    default:
      return new AppError("unknown", `${what}: ${error.message}`, { cause: error });
  }
}

/**
 * `%` and `_` are wildcards in LIKE, and PostgREST's `or()` grammar is
 * comma-and-parenthesis separated — so a search box is a small injection
 * surface into the filter, not just into SQL. Both get neutralised here.
 *
 * Deliberately strips rather than escapes the grammar characters: a user typing
 * a bracket wants to find a bracket about as often as never, and stripping
 * cannot produce a filter that parses into something else.
 */
export function escapeSearchTerm(raw: string): string {
  return raw
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/[,()"']/g, " ")
    .trim();
}
