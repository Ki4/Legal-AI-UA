// What a fixture implementation has to be worth: that a screen built against it
// behaves the same way against the core.
//
// Four groups.
//
//   1. The runtime trace is the fixture file       — the copy, and what watches it.
//   2. The job walks the protocol's own states     — and stops when it is over.
//   3. It fails only in ways the contract declares — codes checked against operations.json.
//   4. It is a fixture, not a source of surprises  — deterministic, isolated, copied out.
//
// Group 1 closes the debt recorded on 2026-08-28: the same trace existed in
// `fixtures/trace.valid.json`, where ajv validated it, and in the console's
// `anatomy.mock.ts`, where nothing did. The console's copy is gone and the one
// that replaced it is compared against the file here — a copy that has to exist
// (ADR-0021 §8 forbids reading the file from this graph) is at least a copy
// something reads.
//
// Group 3 is the one worth explaining. A fixture that throws an error the
// envelope does not declare teaches every call site to handle a case the real
// core will never send, and the handling looks like diligence rather than
// fiction. So the codes this client can produce are checked against
// `operations.json`, per operation.

import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { readJson, type JsonSchemaObject } from "./schema-walk.ts";
import { createFixtureCoreClient } from "./fixture-client.ts";
import { fixtureTrace } from "./fixture-trace.ts";
import { CoreCallError, type Job } from "./protocol.ts";
import type { GenerationTrace } from "./trace.ts";

const here = import.meta.url;

const traceSchema = readJson("../schema/trace.schema.json", here) as JsonSchemaObject;
const jobSchema = readJson("../schema/job.schema.json", here) as JsonSchemaObject;
const errorSchema = readJson("../schema/error.schema.json", here) as JsonSchemaObject;
const requestSchema = readJson(
  "../schema/generation-request.schema.json",
  here,
) as JsonSchemaObject;

const operations = readJson("../schema/operations.json", here) as {
  operations: Record<string, { errors: { status: number; code: string }[] }>;
};

const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
const ajv = new AjvCtor({ allErrors: true });
ajv.addSchema([traceSchema, errorSchema, jobSchema, requestSchema]);

function validateAsWire(id: string, value: unknown): { ok: boolean; errors: string[] } {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`${id} is not in the registry`);
  const ok = validate(JSON.parse(JSON.stringify(value))) as boolean;
  return {
    ok,
    errors: (validate.errors ?? []).map((error) => `${error.instancePath} ${error.message}`),
  };
}

const JOB = "https://legal-ai.ua/schema/job.schema.json";

const request = { service_version_id: "sv-divorce-3", order_id: "ord-2026-000412" };

/** Starts a job and polls it `times` times, returning every job seen in order. */
async function walk(client: ReturnType<typeof createFixtureCoreClient>, times: number) {
  const seen: Job[] = [await client.startGeneration(request)];
  for (let poll = 0; poll < times; poll += 1) {
    seen.push(await client.getGenerationJob(seen[0]!.job_id));
  }
  return seen;
}

describe("the runtime trace is the fixture file", () => {
  it("carries exactly what ajv validates", () => {
    // The copy that ADR-0021 §8 makes unavoidable, and the assertion that turns
    // it from a second source of truth into a mirror. When the JSON changes and
    // this constant does not, this is what says so.
    expect(fixtureTrace).toEqual(readJson("../fixtures/trace.valid.json", here));
  });

  it("validates against the schema in its own right", () => {
    // Not implied by the assertion above once it fails: a `toEqual` mismatch
    // says the two differ, not which one is wrong. This says whether the object
    // that actually ships is a legal trace.
    const { ok, errors } = validateAsWire("https://legal-ai.ua/schema/trace.schema.json", {
      ...fixtureTrace,
    } satisfies GenerationTrace);

    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("the job walks the protocol's own states", () => {
  it("is accepted queued, runs, then succeeds", async () => {
    const [accepted, running, succeeded] = await walk(createFixtureCoreClient(), 2);

    expect(accepted?.status).toBe("queued");
    expect(accepted?.started_at).toBeNull();
    expect(running?.status).toBe("running");
    expect(running?.started_at).not.toBeNull();
    expect(running?.finished_at).toBeNull();
    expect(succeeded?.status).toBe("succeeded");
    expect(succeeded?.result).toEqual(fixtureTrace);
  });

  it("stays where it stopped", async () => {
    // A poll after the end is not another step. Without this the state machine
    // could fall off its own last state and nothing would notice until a screen
    // polled once more than a test did.
    const [, , succeeded, again] = await walk(createFixtureCoreClient(), 3);

    expect(again).toEqual(succeeded);
  });

  it("fails when it was built to fail", async () => {
    const [, , failed] = await walk(createFixtureCoreClient({ outcome: "fails" }), 2);

    expect(failed?.status).toBe("failed");
    expect(failed?.error?.code).toBe("generation_failed");
    expect(failed?.result).toBeNull();
  });

  it("emits jobs the wire schema accepts, in every state", async () => {
    // The point of the whole package: a screen built against this must not be
    // meeting shapes the core cannot send.
    const seen = [
      ...(await walk(createFixtureCoreClient(), 3)),
      ...(await walk(createFixtureCoreClient({ outcome: "fails" }), 3)),
    ];

    for (const job of seen) {
      const { ok, errors } = validateAsWire(JOB, job);
      expect(errors, `${job.status} job`).toEqual([]);
      expect(ok).toBe(true);
    }
  });

  it("keeps the invariants the schema cannot state", async () => {
    // The same four `protocol.test.ts` asserts about the fixtures, asserted here
    // about generated jobs — the fixtures are hand-written and these are not, so
    // one holding does not imply the other.
    const seen = [
      ...(await walk(createFixtureCoreClient(), 3)),
      ...(await walk(createFixtureCoreClient({ outcome: "fails" }), 3)),
    ];

    for (const job of seen) {
      expect(job.result !== null, `result on a ${job.status} job`).toBe(job.status === "succeeded");
      expect(job.error !== null, `error on a ${job.status} job`).toBe(job.status === "failed");
      expect(job.started_at !== null, `start on a ${job.status} job`).toBe(job.status !== "queued");
      expect(job.finished_at !== null, `finish on a ${job.status} job`).toBe(
        job.status === "succeeded" || job.status === "failed",
      );
    }
  });
});

describe("it fails only in ways the contract declares", () => {
  it("refuses a request with a pointer that points nowhere", async () => {
    const client = createFixtureCoreClient();

    await expect(client.startGeneration({ ...request, order_id: "" })).rejects.toBeInstanceOf(
      CoreCallError,
    );
  });

  it("does not know a job it never issued", async () => {
    const client = createFixtureCoreClient();

    await expect(client.getGenerationJob("job-fixture-99")).rejects.toBeInstanceOf(CoreCallError);
  });

  it("throws only codes operations.json declares for that operation", async () => {
    const thrown = async (operation: string, call: () => Promise<unknown>): Promise<string> => {
      try {
        await call();
      } catch (error) {
        if (error instanceof CoreCallError) return error.code;
      }
      throw new Error(`${operation} did not refuse`);
    };

    const client = createFixtureCoreClient();
    const cases: [string, string][] = [
      [
        "startGeneration",
        await thrown("startGeneration", () =>
          client.startGeneration({ ...request, service_version_id: "" }),
        ),
      ],
      [
        "getGenerationJob",
        await thrown("getGenerationJob", () => client.getGenerationJob("job-nothing")),
      ],
    ];

    for (const [operation, code] of cases) {
      const declared = operations.operations[operation]?.errors.map((error) => error.code) ?? [];
      expect(declared, `${operation} may not answer ${code}`).toContain(code);
    }
  });
});

describe("it is a fixture, not a source of surprises", () => {
  it("produces the same job twice", async () => {
    // Fixed timestamps and a per-client counter, so a snapshot of a screen built
    // on this is a snapshot and not a moving target.
    const first = await walk(createFixtureCoreClient(), 2);
    const second = await walk(createFixtureCoreClient(), 2);

    expect(first).toEqual(second);
  });

  it("puts a job on a written-down timeline", async () => {
    // The assertion above compares one run against another **in the same
    // process**, and that is weaker than it reads: a module-level `Date.now()`
    // satisfies it, because the epoch is read once and both runs share it. It
    // was written first, and an injected wall clock walked straight through it.
    // Only an instant written down here makes the claim about tomorrow's run.
    const [accepted, running, succeeded] = await walk(createFixtureCoreClient(), 2);

    expect(accepted?.submitted_at).toBe("2026-08-28T08:00:00Z");
    expect(running?.started_at).toBe("2026-08-28T08:00:02Z");
    expect(succeeded?.finished_at).toBe("2026-08-28T08:00:08Z");
  });

  it("keeps two clients out of each other's jobs", async () => {
    const mine = createFixtureCoreClient();
    const yours = createFixtureCoreClient();
    const job = await mine.startGeneration(request);

    await expect(yours.getGenerationJob(job.job_id)).rejects.toBeInstanceOf(CoreCallError);
  });

  it("gives two jobs from one client different ids and different instants", async () => {
    const client = createFixtureCoreClient();
    const first = await client.startGeneration(request);
    const second = await client.startGeneration(request);

    expect(first.job_id).not.toBe(second.job_id);
    expect(first.submitted_at).not.toBe(second.submitted_at);
  });

  it("hands out a copy, not its own state", async () => {
    // A caller that sorts or edits what it received must not be editing the
    // client's store — a bug no real implementation could have.
    const client = createFixtureCoreClient();
    const accepted = await client.startGeneration(request);
    accepted.status = "succeeded";
    accepted.job_id = "tampered";

    const polled = await client.getGenerationJob("job-fixture-1");
    expect(polled.status).toBe("running");
  });
});
