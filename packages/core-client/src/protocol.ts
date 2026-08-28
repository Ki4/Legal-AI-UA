// How the core is called, as TypeScript sees it.
//
// `schema/job.schema.json`, `schema/error.schema.json`,
// `schema/generation-request.schema.json` and `schema/operations.json` are the
// authority (ADR-0021); this file conforms to them and does not define them.
// The bridges at the bottom are what hold the two together, exactly as
// `trace.ts` does for the payload — see ADR-0021 §3 for why a passing fixture
// is not evidence that a type and a schema agree.
//
// **A call is a job, not an answer** (ADR-0022). `startGeneration` returns the
// job it created and `getGenerationJob` returns the same shape again, so a
// caller learns one object and polls it to a terminal status. The reason is not
// preference: generation runs for minutes and the only path to the core is a
// Supabase Edge Function with a wall-clock limit (ADR-0004), so a synchronous
// call is one that works on fixtures and fails on load.
//
// Wire shape, so snake_case (ADR-0021 §6) — with one deliberate exception, the
// `jobId` parameter of `getGenerationJob`, which is an argument in TypeScript
// and never a key on the wire. Absence is `| null`, never an optional `?`
// property, for the reason `trace.ts` gives.

import type { GenerationTrace, Instant } from "./trace.ts";

/**
 * Where a job is.
 *
 * Declared as an array first so the schema's `enum` has something to be
 * compared against, like every other closed set in this package.
 *
 * There is no `cancelled`, because there is no operation that cancels. A status
 * nothing can produce is a branch every consumer has to write and no fixture can
 * reach — it arrives with the operation, if that operation is ever wanted.
 */
export const JOB_STATUS = ["queued", "running", "succeeded", "failed"] as const;

export type JobStatus = (typeof JOB_STATUS)[number];

/**
 * What went wrong, as a closed set.
 *
 * The set is small on purpose: each member is a different thing for a caller to
 * *do*, not a different thing that happened. `invalid_request` means fix the
 * payload, `not_found` means the identifier is wrong, `rate_limited` means wait,
 * `internal` means retry or escalate, `generation_failed` means this order needs
 * a human. A code nobody would branch on differently belongs in `message`.
 *
 * `generation_failed` is the one that never appears as an HTTP response. By the
 * time a generation can fail, the call that started it has been answered with
 * `202`, so it can only arrive inside `Job.error` — which is why
 * `operations.json` lists it under `job_error_codes` rather than under any
 * operation's `errors`, and why the test asserts that every code has exactly one
 * of those two homes.
 */
export const CORE_ERROR_CODE = [
  "invalid_request",
  "not_found",
  "rate_limited",
  "internal",
  "generation_failed",
] as const;

export type CoreErrorCode = (typeof CORE_ERROR_CODE)[number];

/**
 * One failure, as the core reports it.
 *
 * **No `details` field, and that is a decision rather than an omission.** A
 * free-form bag is where a validation error's offending value ends up, and a
 * generation request's values are client answers — the same argument that keeps
 * arguments out of `ToolCall`, and `docs/CONTRIBUTING.md`'s rule that the
 * stricter reading wins until the question is explicitly resolved. Adding a
 * structured, redacted detail field later is a version bump; removing one that
 * leaked is an incident.
 *
 * **No `retriable` field either**, for the opposite reason: it is derivable from
 * `code`, and this repository refuses two representations of one fact. Whether
 * waiting helps is a decision each caller makes from the code it already has.
 */
export interface CoreError {
  code: CoreErrorCode;
  /**
   * English, for a log and an audit record. **Never rendered to a user.** Every
   * user-visible string is a dictionary key (ADR-0006), and a sentence written
   * by a Python service is in neither locale and cannot be made to be.
   */
  message: string;
}

/**
 * The body of every failed call.
 *
 * Wrapped rather than bare so a body is unambiguous on inspection: `{ "error":
 * … }` cannot be mistaken for a successful payload by a log, a proxy or a
 * reader. The HTTP status still carries the transport-level fact, because
 * throwing that away — answering `200` and putting the outcome in the body —
 * would blind retries, caching and the gateway's own logs to a failure.
 */
export interface ErrorResponse {
  error: CoreError;
}

/**
 * What the gateway sends to start a generation.
 *
 * **Two pointers and no answers.** The answers table does not exist yet (ADM-64)
 * and freezing a shape for it here would be a guess about decisions nobody has
 * made — the mistake `README.md` records for conditions and for law references.
 * Pointers are what exists today and what the core can resolve when it does.
 *
 * A version rather than a service, because an issued document pins the version
 * it was produced from (ADR-0009). The trace answers the coarser question — it
 * carries `service_id`, which is what a reader of a document asks about.
 */
export interface GenerationRequest {
  service_version_id: string;
  order_id: string;
}

/**
 * One generation, as it stands right now.
 *
 * **Flat, with nullable fields, rather than a union tagged by `status`.** A
 * tagged union is the more precise model and it is exactly the shape ADR-0021 §3
 * names as the place the key bridges stop working: the key set stops being
 * constant, so the assertion that TypeScript and the schema list the same
 * properties has nothing left to assert. The invariants a union would have
 * enforced — a result exactly when it succeeded, an error exactly when it failed
 * — are asserted in `protocol.test.ts` instead, and named in `README.md` as
 * something the contract cannot prove about itself.
 */
export interface Job {
  /** Issued by the core, opaque to the caller. */
  job_id: string;
  status: JobStatus;
  submitted_at: Instant;
  /** When work began, or null while the job is still queued. */
  started_at: Instant | null;
  /** When the job reached an outcome, or null while it has not. */
  finished_at: Instant | null;
  /** The trace, present exactly when `status` is `succeeded`. */
  result: GenerationTrace | null;
  /** Why it failed, present exactly when `status` is `failed`. */
  error: CoreError | null;
}

/**
 * The calls the core answers.
 *
 * Every method here is an entry in `schema/operations.json` and the test asserts
 * the two sets are equal — which is what ADR-0021 §1 promised in place of an
 * OpenAPI document: the envelope gets a home outside TypeScript, and unlike a
 * committed OpenAPI file it is *checked*.
 */
export interface CoreClient {
  /** Accepts a generation and returns the queued job. Does not wait for it. */
  startGeneration(request: GenerationRequest): Promise<Job>;
  /** The job as it stands. Returns, rather than throws, on a failed job. */
  getGenerationJob(jobId: string): Promise<Job>;
}

/**
 * A call the core refused.
 *
 * A rejection rather than a result union, and the two error paths are not the
 * same thing. A *call* that fails — a bad payload, an unknown id, the core down
 * — is exceptional: no caller has a use for the rest of its code, and a union
 * would make every call site unwrap something before it could proceed. A *job*
 * that fails is an ordinary outcome that `getGenerationJob` returns normally,
 * because a caller polling a job wants the failed job, not an exception.
 */
export class CoreCallError extends Error {
  readonly code: CoreErrorCode;

  constructor(error: CoreError) {
    super(error.message);
    this.name = "CoreCallError";
    this.code = error.code;
  }
}

// The bridges. `satisfies` proves every listed name is a real one; the
// `…AreExhaustive` types prove none is missing. Together they pin the sets from
// the TypeScript side, and `protocol.test.ts` pins them from the other.

export const CORE_OPERATIONS = [
  "startGeneration",
  "getGenerationJob",
] as const satisfies readonly (keyof CoreClient)[];

export const GENERATION_REQUEST_KEYS = [
  "service_version_id",
  "order_id",
] as const satisfies readonly (keyof GenerationRequest)[];

export const CORE_ERROR_KEYS = ["code", "message"] as const satisfies readonly (keyof CoreError)[];

export const ERROR_RESPONSE_KEYS = ["error"] as const satisfies readonly (keyof ErrorResponse)[];

export const JOB_KEYS = [
  "job_id",
  "status",
  "submitted_at",
  "started_at",
  "finished_at",
  "result",
  "error",
] as const satisfies readonly (keyof Job)[];

/** `never` — and so unsatisfiable — if a method of `CoreClient` is missing above. */
export type CoreOperationsAreExhaustive =
  Exclude<keyof CoreClient, (typeof CORE_OPERATIONS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `GenerationRequest` is missing above. */
export type GenerationRequestKeysAreExhaustive =
  Exclude<keyof GenerationRequest, (typeof GENERATION_REQUEST_KEYS)[number]> extends never
    ? true
    : never;

/** `never` — and so unsatisfiable — if a key of `CoreError` is missing above. */
export type CoreErrorKeysAreExhaustive =
  Exclude<keyof CoreError, (typeof CORE_ERROR_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `ErrorResponse` is missing above. */
export type ErrorResponseKeysAreExhaustive =
  Exclude<keyof ErrorResponse, (typeof ERROR_RESPONSE_KEYS)[number]> extends never ? true : never;

/** `never` — and so unsatisfiable — if a key of `Job` is missing above. */
export type JobKeysAreExhaustive =
  Exclude<keyof Job, (typeof JOB_KEYS)[number]> extends never ? true : never;
