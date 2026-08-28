// The same mechanism `schema.test.ts` runs for the payload, run for the
// envelope: proof that the hand-written protocol types and the hand-written
// schemas still say the same thing — plus the one assertion ADR-0021 §1
// promised and deferred, that `operations.json`'s operation set is exactly
// `CoreClient`'s keys.
//
// Read the six groups below as one argument.
//
//   1. The schemas accept real wire data      — the valid fixtures.
//   2. They reject what they claim to reject   — one case per constraint, per schema.
//   3. Schema and TypeScript agree             — the bridges.
//   4. The envelope agrees with the interface  — operations.json against CoreClient.
//   5. Nothing here is silently unexercised    — the coverage assertions.
//   6. What the schema cannot say              — the job's own invariants.
//
// Group 4 is why this file exists at all rather than being three more describes
// in `schema.test.ts`. ADR-0021 chose plain JSON Schema over OpenAPI and owed
// one thing in exchange: the HTTP envelope must not live only in TypeScript, and
// the file that holds it must be *checked* — which a committed OpenAPI document
// never was. That is this group.
//
// Group 6 is the price of the flat `Job` (see `protocol.ts`). A union tagged by
// `status` would make "a result exactly when it succeeded" unstateable-in-error;
// a flat object with nullable fields keeps the key bridges working and moves
// those invariants here, where fixtures are what carries them.
//
// **This file is only half the gate**, for the reason `schema.test.ts` spells
// out: Vitest transpiles types away, so the exhaustiveness assertions are inert
// under `pnpm test` and fire only under `pnpm typecheck`. Both commands are the
// gate. The four cases run by hand are in `README.md`.

import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { constraintKeywords, readJson, type JsonSchemaObject } from "./schema-walk.ts";
import type { GenerationTrace } from "./trace.ts";
import {
  CORE_ERROR_CODE,
  CORE_ERROR_KEYS,
  CORE_OPERATIONS,
  CoreCallError,
  ERROR_RESPONSE_KEYS,
  GENERATION_REQUEST_KEYS,
  JOB_KEYS,
  JOB_STATUS,
  type CoreErrorKeysAreExhaustive,
  type CoreOperationsAreExhaustive,
  type ErrorResponse,
  type ErrorResponseKeysAreExhaustive,
  type GenerationRequest,
  type GenerationRequestKeysAreExhaustive,
  type Job,
  type JobKeysAreExhaustive,
} from "./protocol.ts";

const here = import.meta.url;

const traceSchema = readJson("../schema/trace.schema.json", here) as JsonSchemaObject;
const jobSchema = readJson("../schema/job.schema.json", here) as JsonSchemaObject;
const errorSchema = readJson("../schema/error.schema.json", here) as JsonSchemaObject;
const requestSchema = readJson(
  "../schema/generation-request.schema.json",
  here,
) as JsonSchemaObject;

interface Operation {
  description: string;
  method: string;
  path: string;
  request: { $ref: string } | null;
  success: { status: number; body: { $ref: string } };
  errors: { status: number; code: string }[];
}

const operations = readJson("../schema/operations.json", here) as {
  protocol_version: number;
  base_path: string;
  error_response: { $ref: string };
  job_error_codes: string[];
  operations: Record<string, Operation>;
};

const invalidCases = readJson("../fixtures/protocol.invalid.json", here) as {
  cases: { schema: string; name: string; constraint: string; value: unknown }[];
};

/**
 * Resolves the fixtures' one-key `$fixture` indirection.
 *
 * The trace has a single home in this package, and a second copy pasted into a
 * succeeded job is exactly the duplication the debt list already carries — so
 * the fixture points at the file instead. Three lines here, and the Python lane
 * reading the same files needs the same three.
 */
function resolveFixtures(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveFixtures);
  if (value === null || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const target = record.$fixture;
  if (typeof target === "string") return resolveFixtures(readJson(`../fixtures/${target}`, here));

  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, resolveFixtures(child)]),
  );
}

const validFixtures = resolveFixtures(readJson("../fixtures/protocol.valid.json", here)) as {
  generation_requests: GenerationRequest[];
  jobs: Job[];
  error_responses: ErrorResponse[];
};

const validTrace = readJson("../fixtures/trace.valid.json", here) as GenerationTrace;

// ajv 8 is CommonJS, so the ESM default import can arrive either as the
// constructor or wrapped in `.default` depending on who did the interop.
const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;

// `strict` stays on, and the registry is what makes the cross-file `$ref`s in
// `job.schema.json` real: a job carries a trace and an error, and those are
// other files' concepts rather than copies of them.
const ajv = new AjvCtor({ allErrors: true });
ajv.addSchema([traceSchema, errorSchema, jobSchema, requestSchema]);

/** Compiled by `$id` rather than by value: `compile` would register a second copy. */
function validatorFor(id: string) {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`${id} is not in the registry`);
  return validate;
}

const validators = {
  job: validatorFor("https://legal-ai.ua/schema/job.schema.json"),
  error: validatorFor("https://legal-ai.ua/schema/error.schema.json"),
  "generation-request": validatorFor("https://legal-ai.ua/schema/generation-request.schema.json"),
} as const;

const schemas: Record<keyof typeof validators, JsonSchemaObject> = {
  job: jobSchema,
  error: errorSchema,
  "generation-request": requestSchema,
};

/** Validates what would actually cross the wire, not the in-memory object. */
function validateAsWire(
  schema: keyof typeof validators,
  value: unknown,
): { ok: boolean; keywords: string[] } {
  const validate = validators[schema];
  const ok = validate(JSON.parse(JSON.stringify(value))) as boolean;
  return { ok, keywords: (validate.errors ?? []).map((error) => error.keyword) };
}

function def(schema: JsonSchemaObject, name: string): JsonSchemaObject | undefined {
  return schema.$defs?.[name];
}

describe("the schemas accept what the core will send", () => {
  it.each(validFixtures.jobs.map((job) => [job.status, job] as const))(
    "validates a %s job",
    (_status, job) => {
      const { ok, keywords } = validateAsWire("job", job);
      expect(keywords).toEqual([]);
      expect(ok).toBe(true);
    },
  );

  it("validates every generation request and error response", () => {
    for (const request of validFixtures.generation_requests) {
      expect(validateAsWire("generation-request", request).ok).toBe(true);
    }
    for (const response of validFixtures.error_responses) {
      expect(validateAsWire("error", response).ok).toBe(true);
    }
  });

  it("accepts a job TypeScript considers well-typed", () => {
    // The direction the JSON fixtures cannot cover: `tsc` checks this literal,
    // ajv checks its serialisation. A field TypeScript allows and the schema
    // forbids fails here.
    const sample = {
      job_id: "job-typed",
      status: "succeeded",
      submitted_at: "2026-08-28T09:00:00Z",
      started_at: "2026-08-28T09:00:01Z",
      finished_at: "2026-08-28T09:02:30.500Z",
      result: validTrace,
      error: null,
    } satisfies Job;

    expect(validateAsWire("job", sample).ok).toBe(true);
  });
});

describe("the schemas reject what they claim to reject", () => {
  // The other half. A validator that accepts everything passes the group above
  // and fails here, which is the only way to tell the two apart.
  it.each(invalidCases.cases)("rejects: $name", ({ schema, constraint, value }) => {
    const { ok, keywords } = validateAsWire(schema as keyof typeof validators, value);
    expect(ok).toBe(false);
    expect(keywords).toContain(constraint);
  });

  it.each(Object.keys(schemas))("has a case for every constraint %s uses", (name) => {
    // Without this, a constraint could be added to a schema and never given a
    // failing case — the schema would claim to enforce something nothing has
    // watched it enforce. `constraintKeywords` counts by exclusion, and stops at
    // a `$ref`, so a constraint reached through one is the other file's test's
    // business rather than a case owed here.
    const constrained = constraintKeywords(schemas[name as keyof typeof schemas]);
    const exercised = new Set(
      invalidCases.cases.filter((c) => c.schema === name).map((c) => c.constraint),
    );

    expect(constrained).toEqual([...exercised].sort());
  });
});

describe("the schemas and the TypeScript agree", () => {
  it("pins the job statuses on both sides", () => {
    expect([...(def(jobSchema, "JobStatus")?.enum ?? [])].sort()).toEqual([...JOB_STATUS].sort());
  });

  it("pins the error codes on both sides", () => {
    expect([...(def(errorSchema, "CoreErrorCode")?.enum ?? [])].sort()).toEqual(
      [...CORE_ERROR_CODE].sort(),
    );
  });

  it.each([
    ["Job", jobSchema, JOB_KEYS],
    ["ErrorResponse", errorSchema, ERROR_RESPONSE_KEYS],
    ["GenerationRequest", requestSchema, GENERATION_REQUEST_KEYS],
  ] as const)("pins %s's property names on both sides", (_name, schema, keys) => {
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([...keys].sort());
    expect([...(schema.required ?? [])].sort()).toEqual([...keys].sort());
  });

  it("pins CoreError's property names on both sides", () => {
    const coreError = def(errorSchema, "CoreError");
    expect(Object.keys(coreError?.properties ?? {}).sort()).toEqual([...CORE_ERROR_KEYS].sort());
    expect([...(coreError?.required ?? [])].sort()).toEqual([...CORE_ERROR_KEYS].sort());
  });

  it("lists every property and every operation, with none missing", () => {
    // Compile-time, not runtime: these types are `never` if a key is absent from
    // its bridge array, and `satisfies never` does not compile.
    expect(true satisfies JobKeysAreExhaustive).toBe(true);
    expect(true satisfies CoreErrorKeysAreExhaustive).toBe(true);
    expect(true satisfies ErrorResponseKeysAreExhaustive).toBe(true);
    expect(true satisfies GenerationRequestKeysAreExhaustive).toBe(true);
    expect(true satisfies CoreOperationsAreExhaustive).toBe(true);
  });

  it("closes every object it defines", () => {
    // Without this the key bridges above prove nothing: a schema that permits
    // extra properties would accept a TypeScript type with fields it has never
    // heard of. Asserted over every object `$def` rather than a written list, so
    // a new one cannot arrive open.
    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.additionalProperties, `${name} is left open`).toBe(false);
      for (const [defName, defSchema] of Object.entries(schema.$defs ?? {})) {
        if (defSchema.type === "object") {
          expect(defSchema.additionalProperties, `${name}'s ${defName} is left open`).toBe(false);
        }
      }
    }
  });
});

describe("the envelope agrees with the interface", () => {
  it("describes exactly the operations CoreClient declares", () => {
    // ADR-0021 §1's promise, and the reason there is no OpenAPI document: the
    // envelope lives outside TypeScript *and* is checked against it. An
    // operation added to one side alone fails here.
    expect(Object.keys(operations.operations).sort()).toEqual([...CORE_OPERATIONS].sort());
  });

  it("resolves every $ref it points at", () => {
    // A committed envelope whose references have rotted describes nothing. ajv's
    // registry is the resolver, so this asks the same question the validators
    // ask, rather than a string comparison that would pass on a stale path.
    const refs: string[] = [];
    const collect = (node: unknown): void => {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(collect);
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (key === "$ref" && typeof child === "string") refs.push(child);
        else collect(child);
      }
    };
    collect(operations);

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ajv.getSchema(ref), `${ref} does not resolve`).toBeTruthy();
    }
  });

  it("gives every error code exactly one home", () => {
    // A code is either something a call is answered with or something a job
    // carries, never both and never neither. `generation_failed` is the reason
    // the distinction is worth asserting: by the time a generation can fail, the
    // call that started it has already been answered with 202.
    const overHttp = new Set(
      Object.values(operations.operations).flatMap((operation) =>
        operation.errors.map((error) => error.code),
      ),
    );
    const inJob = new Set(operations.job_error_codes);

    expect([...overHttp].filter((code) => inJob.has(code))).toEqual([]);
    expect([...overHttp, ...inJob].sort()).toEqual([...CORE_ERROR_CODE].sort());
  });

  it("answers the submission before the work is done", () => {
    // The job decision (ADR-0022) as something a test can fail. A `200` here
    // would mean the call waits for the generation — which is the design the
    // gateway's wall-clock limit rules out.
    expect(operations.operations.startGeneration?.success.status).toBe(202);
    expect(operations.operations.getGenerationJob?.success.body.$ref).toBe(
      operations.operations.startGeneration?.success.body.$ref,
    );
  });

  it("carries a request body exactly where the method has one", () => {
    for (const [name, operation] of Object.entries(operations.operations)) {
      expect(operation.request === null, `${name} disagrees with its method`).toBe(
        operation.method === "GET",
      );
    }
  });
});

describe("nothing here is silently unexercised", () => {
  it("exercises every schema the files define", () => {
    // An unexercised type must fail rather than pass quietly. When a `$def` is
    // added, this goes red until a fixture reaches it.
    expect(Object.keys(jobSchema.$defs ?? {}).sort()).toEqual(["JobStatus"]);
    expect(Object.keys(errorSchema.$defs ?? {}).sort()).toEqual(["CoreError", "CoreErrorCode"]);
    expect(Object.keys(requestSchema.$defs ?? {})).toEqual([]);
  });

  it("exercises every job status at least once", () => {
    // A status no fixture carries is a state nothing has watched render.
    const used = new Set(validFixtures.jobs.map((job) => job.status));
    expect([...used].sort()).toEqual([...JOB_STATUS].sort());
  });

  it("exercises every error code at least once", () => {
    const overHttp = validFixtures.error_responses.map((response) => response.error.code);
    const inJobs = validFixtures.jobs
      .map((job) => job.error)
      .filter((error) => error !== null)
      .map((error) => error.code);

    expect([...new Set([...overHttp, ...inJobs])].sort()).toEqual([...CORE_ERROR_CODE].sort());
  });

  it("exercises both sides of every nullable field", () => {
    // A `| null` that is never null in any fixture, or never non-null, is half a
    // field — and on this object each of the four is half of an invariant the
    // schema cannot state.
    const columns: [string, unknown[]][] = [
      ["started_at", validFixtures.jobs.map((job) => job.started_at)],
      ["finished_at", validFixtures.jobs.map((job) => job.finished_at)],
      ["result", validFixtures.jobs.map((job) => job.result)],
      ["error", validFixtures.jobs.map((job) => job.error)],
    ];
    for (const [name, values] of columns) {
      expect(values, `${name} is never null`).toContain(null);
      expect(
        values.some((value) => value !== null),
        `${name} is never set`,
      ).toBe(true);
    }
  });

  it("exercises an instant with and without milliseconds", () => {
    // The `Instant` pattern makes milliseconds optional, and a job's timestamps
    // are where a core would most plausibly send one shape only.
    const instants = validFixtures.jobs
      .flatMap((job) => [job.submitted_at, job.started_at, job.finished_at])
      .filter((instant): instant is string => instant !== null);

    expect(instants.some((instant) => instant.includes("."))).toBe(true);
    expect(instants.some((instant) => !instant.includes("."))).toBe(true);
  });
});

describe("what the schema cannot say", () => {
  // The invariants a `status`-tagged union would have carried in the type
  // system, asserted against the fixtures instead — because the union is the
  // shape that breaks the key bridges (ADR-0021 §3), and a contract that cannot
  // check itself is worse than one that says out loud what it checks elsewhere.
  it("carries a result exactly when the job succeeded", () => {
    for (const job of validFixtures.jobs) {
      expect(job.result !== null, `${job.status} job ${job.job_id}`).toBe(
        job.status === "succeeded",
      );
    }
  });

  it("carries an error exactly when the job failed", () => {
    for (const job of validFixtures.jobs) {
      expect(job.error !== null, `${job.status} job ${job.job_id}`).toBe(job.status === "failed");
    }
  });

  it("has started exactly when it is no longer queued", () => {
    for (const job of validFixtures.jobs) {
      expect(job.started_at !== null, `${job.status} job ${job.job_id}`).toBe(
        job.status !== "queued",
      );
    }
  });

  it("has finished exactly when it reached a terminal status", () => {
    const terminal = new Set(["succeeded", "failed"]);
    for (const job of validFixtures.jobs) {
      expect(job.finished_at !== null, `${job.status} job ${job.job_id}`).toBe(
        terminal.has(job.status),
      );
    }
  });

  it("orders a job's timestamps", () => {
    for (const job of validFixtures.jobs) {
      const stamps = [job.submitted_at, job.started_at, job.finished_at].filter(
        (stamp): stamp is string => stamp !== null,
      );
      expect([...stamps].sort(), `${job.job_id} runs backwards`).toEqual(stamps);
    }
  });
});

describe("a refused call", () => {
  it("keeps the code a caller branches on", () => {
    // The one piece of runtime behaviour in this file. `Error` drops anything a
    // subclass does not assign, and a `CoreCallError` without its code would
    // leave every call site parsing the message.
    const failure = new CoreCallError({ code: "not_found", message: "No job job-7f3z." });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).toBe("not_found");
    expect(failure.message).toBe("No job job-7f3z.");
  });
});
