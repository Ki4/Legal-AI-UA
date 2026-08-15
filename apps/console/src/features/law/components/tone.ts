// Which tone a norm's state wears, and which its freshness does — because a
// colour on this screen is a claim about whether somebody has to act.
//
// A `Record<LawNormState, BadgeTone>` rather than a function with a `default`,
// for the reason `shared/vocabulary.ts` gives about its own maps: a state added
// to `law_norm_state` in a migration then fails to compile here until somebody
// has decided what it looks like. A `default` would paint it neutral, which on
// this screen is the answer §9.10 spends a section refusing.

import type { LawNormState } from "@legal-ai/db";
import type { BadgeTone } from "@legal-ai/ui";
import type { NormFreshness } from "../api";

export const NORM_STATE_TONE: Record<LawNormState, BadgeTone> = {
  // Entered and never fetched. Not `ok`, because nothing has been confirmed —
  // and not `danger`, because nothing is wrong: today it is every norm's state.
  unverified: "neutral",
  verified: "ok",
  // Something moved and nobody has read it yet. This is the state a triage queue
  // is opened to find (ADM-46).
  drifted: "warn",
  under_review: "warn",
  // A document the firm sells is wrong until a new version ships.
  impact_confirmed: "danger",
  // §9.10, and the reason it is `danger` rather than `warn`: a fetch that keeps
  // failing is exactly as serious as a detected change, because it is the state
  // in which a change would go unseen.
  unreachable: "danger",
};

export function normStateTone(state: LawNormState): BadgeTone {
  return NORM_STATE_TONE[state];
}

/**
 * The freshness badge, which is a different claim from the state badge and sits
 * beside it rather than replacing it.
 *
 * `verified` + `stale` is the pair the whole of §9.10 is about: the last thing
 * we heard was "no difference", and we have not heard anything since. A screen
 * with one badge would show that norm as green.
 */
export function freshnessTone(freshness: NormFreshness): BadgeTone {
  switch (freshness.kind) {
    case "fresh":
      return "ok";
    case "stale":
      return "warn";
    case "never_checked":
      return "neutral";
  }
}
