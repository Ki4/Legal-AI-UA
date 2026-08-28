// A `CoreClient` that answers out of fixtures, so the console can be built
// against the protocol before `apps/core` exists.
//
// ADR-0021 §7 is what asked for this and what it replaced: ADR-0004 and the
// ROADMAP both said "typed HTTP contract + MSW mocks", and MSW intercepts HTTP
// that no client speaks yet. A fixture implementation typed as the interface is
// what stands in until the gateway (ADM-5) gives MSW something to intercept.
//
// Three properties, in the order they matter:
//
// **It advances on poll, not on a clock.** A job moves `queued` → `running` →
// terminal one step per `getGenerationJob`, and a poll after the end returns the
// same terminal job. Wall-clock progress would make a screen show a different
// state depending on how fast the machine was and make every test that watches
// the sequence a race. So the caller's own polling is the clock, and a test that
// wants the running state polls once.
//
// **Its timestamps are fixed.** They come from a constant epoch and an offset
// per state, so two runs produce byte-identical jobs. A fixture that returns
// `new Date()` cannot be compared against anything.
//
// **It hands out copies.** A caller that mutates what it received would edit
// this module's own state, and the next caller would get the mutation — a bug no
// implementation reading a real response could have, so a fixture that permits
// it teaches the wrong lesson. Same reason `anatomy.mock.ts` copies its arrays.
//
// No artificial delay here, unlike `apps/console/src/shared/api/fixture-store.ts`:
// that file reads `import.meta.env`, which is Vite's, and this package is read by
// a Deno gateway and by Node tests. The console's `api/` layer is where a
// loading state gets its delay, and it already has one.

import { CoreCallError, type CoreClient, type GenerationRequest, type Job } from "./protocol.ts";
import { fixtureTrace } from "./fixture-trace.ts";
import type { Instant } from "./trace.ts";

/** Fixed, so that every run produces the same job. */
const EPOCH = Date.parse("2026-08-28T08:00:00.000Z");

/** Seconds after a job's own submission at which each state is reached. */
const STARTS_AFTER = 2;
const FINISHES_AFTER = 8;

/** Enough of a gap that two jobs from one client never share an instant. */
const SECONDS_BETWEEN_JOBS = 60;

function instantAt(seconds: number): Instant {
  // `.000` is legal under the `Instant` pattern, but the core writes seconds
  // when it has no milliseconds and so does this.
  return new Date(EPOCH + seconds * 1000).toISOString().replace(".000Z", "Z");
}

/** A caller may not reach into what it was handed. */
function copyOf(job: Job): Job {
  return JSON.parse(JSON.stringify(job)) as Job;
}

export interface FixtureCoreClientOptions {
  /**
   * How a job this client accepts ends.
   *
   * An option on the client rather than a marker inside the request, because a
   * magic `order_id` that means "now fail" is a second protocol nobody wrote
   * down, and it would be indistinguishable from a real id on the wire. A screen
   * that needs the failed state builds a client that fails.
   */
  outcome?: "succeeds" | "fails";
}

/**
 * A `CoreClient` backed by `fixtureTrace`.
 *
 * Each call to this function gets its own jobs and its own counter: two screens,
 * or two tests, must not be able to see each other's work.
 */
export function createFixtureCoreClient(options: FixtureCoreClientOptions = {}): CoreClient {
  const outcome = options.outcome ?? "succeeds";
  const jobs = new Map<string, Job>();
  let issued = 0;

  return {
    async startGeneration(request: GenerationRequest): Promise<Job> {
      // The two codes below are the ones `operations.json` declares for these
      // operations, and a test holds this file to that list. A fixture that
      // fails in a way the contract does not describe is a fixture teaching a
      // caller to handle something it will never meet.
      if (request.service_version_id === "" || request.order_id === "") {
        throw new CoreCallError({
          code: "invalid_request",
          message: "service_version_id and order_id must both be non-empty.",
        });
      }

      const base = issued * SECONDS_BETWEEN_JOBS;
      issued += 1;

      const job: Job = {
        job_id: `job-fixture-${issued}`,
        status: "queued",
        submitted_at: instantAt(base),
        started_at: null,
        finished_at: null,
        result: null,
        error: null,
      };
      jobs.set(job.job_id, job);

      return copyOf(job);
    },

    async getGenerationJob(jobId: string): Promise<Job> {
      const job = jobs.get(jobId);
      if (job === undefined) {
        throw new CoreCallError({ code: "not_found", message: `No job ${jobId}.` });
      }

      const base = (Number(job.job_id.replace("job-fixture-", "")) - 1) * SECONDS_BETWEEN_JOBS;

      if (job.status === "queued") {
        job.status = "running";
        job.started_at = instantAt(base + STARTS_AFTER);
      } else if (job.status === "running") {
        job.finished_at = instantAt(base + FINISHES_AFTER);
        if (outcome === "succeeds") {
          job.status = "succeeded";
          job.result = fixtureTrace;
        } else {
          job.status = "failed";
          job.error = {
            code: "generation_failed",
            message: "Block assembly stopped: no answer for a field the selected condition reads.",
          };
        }
      }

      // A poll after the end is not another step. Nothing above moves a terminal
      // job, so this returns what the previous poll returned.
      return copyOf(job);
    },
  };
}
