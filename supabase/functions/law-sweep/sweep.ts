// The sweep: check every norm whose cadence says it is owed one (§9.8, ADM-44).
//
// **This file decides how a batch behaves, and nothing about what a check
// means.** What one probe implies is `handler.ts`'s `checkNorm`, imported here
// rather than reproduced — the same rules the console's entry form runs through,
// so a norm checked by a person and the same norm checked at three in the
// morning cannot reach two different conclusions. What is left is the handful of
// decisions that only exist because this caller is unattended and plural, and
// each of them is here because getting it wrong produces the same failure: a
// queue with something stuck at the front of it.
//
// Three of those, in the order they bite:
//
//   1. **One norm's failure ends that norm, not the sweep.** A throw from a
//      check — a database hiccup, a body that broke the parser in a new way —
//      is caught, counted, and the loop moves on. Left uncaught it would end the
//      run at the first bad row, and since the batch is ordered most-overdue
//      first, that row is at the head of the next run too. One permanently
//      unlucky norm would silently stop every other norm in the register from
//      ever being checked again, and the symptom would be perfect green.
//   2. **Sequential, deliberately.** A parallel sweep of a hundred norms is a
//      hundred concurrent 547 KB requests at one government site, which is
//      indistinguishable from an attack from the far end and would earn the
//      block it deserves. §9.8 already says scale is not the constraint here.
//   3. **A budget, and it is not a failure.** The runtime kills a function that
//      runs too long, and a sweep killed mid-norm reports nothing at all — the
//      run would be invisible rather than short. So it stops starting new norms
//      when the budget is spent and says how many it left. Nothing is lost by
//      stopping: every norm it did check has a fresh `last_checked_at` and has
//      therefore moved to the back of the queue, so the next run resumes exactly
//      where this one stopped, without anybody storing a cursor.
//
// The ordering and the filtering are the database's — `law_norms_due_for_probe`
// applies `effective_probe_interval` and drops act-scoped rows. Nothing here
// re-sorts or re-filters it. A cap applied in two places is a cap that will
// disagree with itself, and this is the caller whose whole job is to honour it.

import { checkNorm } from "../law-article/handler.ts";
import type { HandlerDeps, NormCheck } from "../law-article/handler.ts";

/** The batch, as one question. Ordering and eligibility belong to the SQL. */
export interface DueRegister {
  due(batchLimit: number): Promise<string[]>;
}

export interface SweepDeps extends HandlerDeps {
  register: DueRegister;
}

/**
 * How a single norm came out. Every `NormCheck` kind, plus the one outcome a
 * check cannot report about itself.
 */
export type SweepVerdict = NormCheck["kind"] | "errored";

export interface SweptNorm {
  normId: string;
  verdict: SweepVerdict;
  /** The state the register now holds, where the check reached one. */
  state?: string;
  /** Present only on `errored`: the message, so a log says which norm and why. */
  detail?: string;
}

export interface SweepReport {
  /** What the batch limit was, after clamping. */
  requested: number;
  /** How many the register said were due — never more than `requested`. */
  due: number;
  /** How many were actually attempted before the budget ran out. */
  checked: number;
  /** True when norms were left unchecked because time, not the register, ran out. */
  stoppedEarly: boolean;
  /** One entry per attempted norm, in the order the register handed them over. */
  norms: SweptNorm[];
  /** The same, counted — what a health screen and a log line actually read. */
  verdicts: Partial<Record<SweepVerdict, number>>;
}

/**
 * The default batch, and the ceiling on one.
 *
 * 25 is a size chosen from the wall clock rather than from the register: a
 * sequential check is two requests against a slow public site, so a batch is
 * measured in minutes and the budget below is what actually ends a run. The
 * ceiling exists so that a caller cannot ask for a number that guarantees the
 * budget cuts the batch — a run that is always truncated reports `stoppedEarly`
 * on every single sweep, which is an alarm that means nothing after the second
 * time anybody sees it.
 */
export const DEFAULT_BATCH = 25;
export const MAX_BATCH = 100;

/** Leaves room to answer inside the runtime's ceiling rather than be killed at it. */
export const DEFAULT_BUDGET_MS = 60_000;

export interface SweepOptions {
  batchLimit?: number;
  budgetMs?: number;
}

export async function sweep(deps: SweepDeps, options: SweepOptions = {}): Promise<SweepReport> {
  const requested = clampBatch(options.batchLimit);
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const startedAt = deps.now().getTime();

  const dueIds = await deps.register.due(requested);

  const norms: SweptNorm[] = [];
  let stoppedEarly = false;

  for (const normId of dueIds) {
    // Checked before the norm rather than after it, so the budget bounds when a
    // check *starts*. A check that begins inside the budget is allowed to finish:
    // abandoning one mid-flight is how a revision gets written with no
    // `last_checked_at` beside it.
    if (deps.now().getTime() - startedAt >= budgetMs) {
      stoppedEarly = true;
      break;
    }

    norms.push(await one(deps, normId));
  }

  return {
    requested,
    due: dueIds.length,
    checked: norms.length,
    stoppedEarly,
    norms,
    verdicts: count(norms),
  };
}

async function one(deps: SweepDeps, normId: string): Promise<SweptNorm> {
  try {
    const check = await checkNorm(deps, { action: "observe", normId });

    // No `confirmedFingerprint` is passed, and its absence is a rule rather than
    // an omission. A confirmation is a person saying "these are the words I
    // meant" about text they read (§9.5.7); a scheduled sweep has read nothing
    // and confirmed nothing. Passing the stored fingerprint would make every
    // unchanged norm look freshly confirmed by nobody — §9.10 read backwards,
    // arriving through the one caller that runs while everyone is asleep.
    return check.kind === "read"
      ? { normId, verdict: check.kind, state: check.state }
      : { normId, verdict: check.kind };
  } catch (error) {
    return {
      normId,
      verdict: "errored",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function count(norms: readonly SweptNorm[]): Partial<Record<SweepVerdict, number>> {
  const verdicts: Partial<Record<SweepVerdict, number>> = {};
  for (const norm of norms) {
    verdicts[norm.verdict] = (verdicts[norm.verdict] ?? 0) + 1;
  }
  return verdicts;
}

/**
 * A batch size, or the default. Total by construction: a caller that sends a
 * string, a fraction or a negative number gets a batch rather than a 400,
 * because the caller is a scheduler and there is nobody to read the 400.
 */
export function clampBatch(requested: unknown): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) return DEFAULT_BATCH;
  const whole = Math.floor(requested);
  if (whole < 1) return DEFAULT_BATCH;
  return Math.min(whole, MAX_BATCH);
}

/**
 * Who may start a sweep.
 *
 * Two callers, and they authenticate differently because they are different
 * kinds of thing. A person kicking a run by hand is an `admin`, established the
 * way `law-article` establishes it — by asking the auth server, not by decoding
 * a token here. The scheduler is a machine with no user behind it, and it
 * presents the service-role key, which is the credential a cron job in this
 * platform actually has.
 *
 * **`lawyer` is absent on purpose.** A sweep is not a read: it writes to every
 * norm it touches and it costs the publisher a request per article. The lawyer's
 * question — "is my citation still good" — is answered by `law-article` for one
 * norm, with a confirmation attached. Nothing about triage needs the whole
 * register re-checked on demand.
 *
 * The comparison is length-first and then constant-time over the whole string.
 * A `===` on a secret leaks its prefix to anybody who can time the endpoint, and
 * while that is a remote attack against a key that would already be catastrophic
 * to hold, this is four lines and the alternative is an argument.
 */
export function authorizeSweep(
  caller: { role: string | null; bearer: string | null },
  secrets: { serviceRoleKey: string },
): boolean {
  if (caller.role === "admin") return true;
  if (caller.bearer === null || secrets.serviceRoleKey === "") return false;
  return constantTimeEquals(caller.bearer, secrets.serviceRoleKey);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
