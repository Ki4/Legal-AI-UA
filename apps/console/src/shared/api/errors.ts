// The one error type that crosses an api/ boundary (ADR-0012, convention 3 and 4).
// Nothing below this line leaks outward: no PostgrestError, no Postgres error codes.

export type AppErrorCode =
  | "forbidden" // the caller may not do this, or may not see the row
  | "not_found" // no such entity
  | "validation" // the input was rejected
  | "conflict" // someone else changed it first
  | "network" // the request never completed
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}

/**
 * Guards the failure mode that motivated ADR-0012.
 *
 * A write denied by an RLS `USING` clause is NOT an error: Postgres filters the
 * row out of the statement, so the UPDATE matches nothing and Supabase returns
 * `{ data: [], error: null }`. A denial caught by `WITH CHECK` raises instead —
 * so the same denial is loud or silent depending on which clause caught it, and
 * the caller cannot tell. Every mutation runs its result through here.
 *
 * `noUncheckedIndexedAccess` is on, so reading rows[0] needs the length check
 * anyway; this makes that check mean something.
 */
export function expectOne<T>(rows: readonly T[], what: string): T {
  const [first] = rows;

  if (first === undefined) {
    throw new AppError(
      "forbidden",
      `${what}: nothing was written. Either you lack the rights, or the record changed first.`,
    );
  }

  if (rows.length > 1) {
    throw new AppError("conflict", `${what}: expected one record, got ${rows.length}.`);
  }

  return first;
}
