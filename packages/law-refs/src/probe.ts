// What one probe of one norm means (spec §9.7, §9.10, §9.11, §9.15).
//
// The fetcher's two jobs are cleanly separable and are separated here: getting
// bytes off the network, and deciding what those bytes imply. Only the first
// needs a runtime. The second is where every rule in §9 actually lives, and
// putting it in a pure function is what lets those rules be **run** rather than
// described — the difference §9.15 condition 3 is about, applied to our own
// logic instead of to the parser.
//
// So the edge function (ADR-0020) fetches, extracts, and hands the outcome to
// `decideProbe`. It writes what comes back and decides nothing itself.
//
// **The rule that shapes everything below: a check is not a verification.**
// §9.10 refuses to render "no difference found" and "no check completed" alike,
// so every outcome here records that a check happened and only one of them
// advances the timestamp that means it matched. A decision layer that collapsed
// the two would make a broken fetcher indistinguishable from a quiet week, and
// no test above it could tell.

import { fingerprintRevision, NORMALIZER_VERSION, normalizeArticleText } from "./text.ts";
import type { ArticleRevision, LawNormState, ProbeFailure, RevisionOrigin } from "./types.ts";

/**
 * The states a person owns, which a scheduled job must never overwrite.
 *
 * This is not tidiness. `impact_confirmed` is what pauses a published service
 * (Q5, §9.16): a lawyer read the diff, decided the document is wrong, and the
 * service came off sale. The next probe finds the article unchanged — because
 * nothing has changed since the amendment — and a decision layer that wrote
 * `verified` from that would **put the service back on sale**, hours after a
 * human took it off, with no one having decided anything.
 *
 * `under_review` is the same shape, one step earlier: a lawyer is mid-triage and
 * the job would quietly declare the question settled underneath them.
 *
 * Nothing is lost by holding them. The two timestamps are still written, and
 * staleness is derived from `last_verified_at` (§9.11), so a norm held at
 * `under_review` while its fetch fails still surfaces on the health screen —
 * the alarm survives even though the state does not move.
 */
const HELD_BY_A_PERSON: readonly LawNormState[] = ["under_review", "impact_confirmed"];

/** What the fetcher managed to get. Produced by the edge function, never here. */
export type ProbeOutcome =
  | { kind: "failed"; failure: ProbeFailure }
  | {
      kind: "fetched";
      /** The raw extracted article text, before any reduction. */
      text: string;
      /** The redaction date the page stated, ISO `yyyy-mm-dd`, or null if it stated none. */
      publishedRevisionDate: string | null;
    };

/** The norm as the register currently holds it, plus the text of its newest revision. */
export interface ProbedNorm {
  state: LawNormState;
  /** Null until the first successful fetch. */
  fingerprint: string | null;
  normalizerVersion: number;
  /**
   * `content` of the newest `law_norm_revisions` row, or null if there is none.
   *
   * The register's history is **load-bearing here, not decorative**: when the
   * normalizer has moved, this is the only thing that can tell our own rule
   * change apart from an amendment, by being reduced again under the new rules
   * and compared. §9.7 says the text is kept so that normalization stays
   * revisable; this is the line where that promise is actually spent.
   */
  previousText: string | null;
}

export interface ProbeInput {
  norm: ProbedNorm;
  outcome: ProbeOutcome;
  /**
   * Whether a signal for this norm is already awaiting triage.
   *
   * A second amendment arriving before a lawyer has opened the first is one
   * queue entry, not two. §9.4's failure — a lawyer who stops opening alerts —
   * is reached just as surely by repeating a true alarm as by raising false
   * ones.
   */
  hasOpenSignal: boolean;
}

/**
 * Why the decision came out the way it did.
 *
 * A code rather than a sentence, because it is written to `law_signals` and
 * counted on a health screen; the sentence a lawyer reads is a dictionary key
 * built from it, per the language rule in the root `CLAUDE.md`.
 */
export type ProbeVerdict =
  /** Nothing usable came back. Never "no change" (§9.15). */
  | "unreachable"
  /** The first successful fetch of this norm. Nothing to compare against yet. */
  | "first_fetch"
  /** Fetched, reduced, and identical to what we already held. */
  | "unchanged"
  /** The publisher's text moved. */
  | "drifted"
  /** Our reduction moved and the publisher's text did not (§9.7). */
  | "renormalized"
  /**
   * The normalizer moved and we hold no previous text to recompute from, so the
   * two cannot be told apart. Treated as a drift — see the note at the branch.
   */
  | "drifted_indeterminate";

export interface ProbeDecision {
  verdict: ProbeVerdict;
  /** The state to write. Equal to the current one when a person holds it. */
  state: LawNormState;
  /** True when `state` differs from what the norm carried coming in. */
  stateChanged: boolean;
  /** Whether a person's state was left alone. Recorded so a health screen can say so. */
  heldByPerson: boolean;
  /**
   * `last_checked_at` is written on **every** outcome, including failures, and
   * this field exists to say so out loud rather than by omission (§9.10).
   */
  markChecked: true;
  /** `last_verified_at` — only a check that both succeeded and matched. */
  markVerified: boolean;
  /** The revision row to insert, or null when nothing changed. */
  revision: { revision: ArticleRevision; origin: RevisionOrigin } | null;
  /** Whether a triage signal is owed (§9.16 starts its clock from this). */
  raiseSignal: boolean;
}

/**
 * Decide what a probe means. Pure, and asynchronous only because hashing is.
 */
export async function decideProbe(input: ProbeInput): Promise<ProbeDecision> {
  const { norm, outcome, hasOpenSignal } = input;

  if (outcome.kind === "failed") {
    return settle(
      norm,
      {
        verdict: "unreachable",
        proposedState: "unreachable",
        markVerified: false,
        revision: null,
        // A norm nobody can fetch is a health matter (§9.10, ADM-49), not a legal
        // one: there is no diff to read, so there is nothing for triage to do and
        // a queue entry would only dilute the queue. The alarm is the state plus
        // the timestamp that stopped moving.
        wantsSignal: false,
      },
      hasOpenSignal,
    );
  }

  const fetched = await fingerprintRevision(outcome.text);
  if (!fetched.ok) {
    // Reduction refusing the text is an assertion failing, and §9.15 gives
    // assertions exactly one destination.
    return settle(
      norm,
      {
        verdict: "unreachable",
        proposedState: "unreachable",
        markVerified: false,
        revision: null,
        wantsSignal: false,
      },
      hasOpenSignal,
    );
  }

  const revision = fetched.revision;

  if (norm.fingerprint === null) {
    // Nothing to compare against. Learning what an article says is not an event
    // anybody should be paged for, and the opposite choice would page a lawyer
    // once per norm on the day the fetcher is first switched on.
    return settle(
      norm,
      {
        verdict: "first_fetch",
        proposedState: "verified",
        markVerified: true,
        revision: { revision, origin: "observed" },
        wantsSignal: false,
      },
      hasOpenSignal,
    );
  }

  if (norm.normalizerVersion !== NORMALIZER_VERSION) {
    return settle(norm, await acrossNormalizers(norm, revision), hasOpenSignal);
  }

  if (norm.fingerprint === revision.fingerprint) {
    return settle(
      norm,
      {
        verdict: "unchanged",
        proposedState: "verified",
        markVerified: true,
        revision: null,
        wantsSignal: false,
      },
      hasOpenSignal,
    );
  }

  return settle(
    norm,
    {
      verdict: "drifted",
      proposedState: "drifted",
      // Deliberately false. `last_verified_at` means the last check that
      // succeeded *and matched*; advancing it here would make a norm whose text
      // moved look freshly confirmed, which is §9.10 read backwards.
      markVerified: false,
      revision: { revision, origin: "observed" },
      wantsSignal: true,
    },
    hasOpenSignal,
  );
}

/**
 * The comparison to make when our own rules moved between two probes.
 *
 * Comparing the new fingerprint against the stored one answers nothing here:
 * they were produced by different reductions, so they differ whether or not the
 * article did. What can be compared is the *stored text* reduced under today's
 * rules against the *fetched text* reduced under today's rules — one normalizer,
 * two texts, which is a question with a meaning.
 *
 * This is the recomputation §9.7 promises, and it carries the limit recorded
 * there: the stored text is already reduced, so the answer is exact for rules
 * that reduce further and approximate for rules that would have needed a
 * distinction the earlier reduction discarded.
 */
async function acrossNormalizers(norm: ProbedNorm, fetched: ArticleRevision): Promise<Settlement> {
  if (norm.previousText === null) {
    // A fingerprint with no text behind it — a norm from before the revision log
    // existed. The two cases cannot be told apart, so this picks the one whose
    // failure is survivable: a false alarm costs a lawyer a few minutes, and a
    // missed amendment costs a client a document that is wrong. The verdict says
    // which branch was taken so that a health screen can count how much of this
    // is happening rather than leaving it invisible.
    return {
      verdict: "drifted_indeterminate",
      proposedState: "drifted",
      markVerified: false,
      revision: { revision: fetched, origin: "observed" },
      wantsSignal: true,
    };
  }

  const recomputed = normalizeArticleText(norm.previousText);
  const unchanged = recomputed.ok && recomputed.text === fetched.text;

  if (unchanged) {
    return {
      verdict: "renormalized",
      proposedState: "verified",
      // The text is confirmed identical, so this genuinely is a check that
      // succeeded and matched — it simply matched under new arithmetic.
      markVerified: true,
      revision: { revision: fetched, origin: "renormalized" },
      wantsSignal: false,
    };
  }

  return {
    verdict: "drifted",
    proposedState: "drifted",
    markVerified: false,
    // `observed`, and the distinction is the entire point of the column: both
    // things happened, and the half a lawyer must see is the publisher's.
    revision: { revision: fetched, origin: "observed" },
    wantsSignal: true,
  };
}

interface Settlement {
  verdict: ProbeVerdict;
  proposedState: LawNormState;
  markVerified: boolean;
  revision: { revision: ArticleRevision; origin: RevisionOrigin } | null;
  wantsSignal: boolean;
}

/**
 * Apply the two rules that hold for every outcome: a person's state wins, and a
 * signal already waiting is not raised twice.
 *
 * One place rather than eight, because these are exactly the rules that get
 * forgotten in the eighth branch somebody adds. `hasOpenSignal` is required
 * rather than defaulted for the same reason: a default of `false` would make
 * forgetting it raise a duplicate signal silently, which is the failure this
 * argument exists to prevent.
 */
function settle(norm: ProbedNorm, settlement: Settlement, hasOpenSignal: boolean): ProbeDecision {
  const heldByPerson = HELD_BY_A_PERSON.includes(norm.state);
  const state = heldByPerson ? norm.state : settlement.proposedState;

  return {
    verdict: settlement.verdict,
    state,
    stateChanged: state !== norm.state,
    heldByPerson,
    markChecked: true,
    markVerified: settlement.markVerified,
    revision: settlement.revision,
    raiseSignal: settlement.wantsSignal && !hasOpenSignal,
  };
}
