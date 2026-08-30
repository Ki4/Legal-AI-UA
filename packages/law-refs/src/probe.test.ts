import { describe, expect, it } from "vitest";
import { decideProbe } from "./probe.ts";
import type { ProbeInput, ProbedNorm } from "./probe.ts";
import { fingerprintRevision, NORMALIZER_VERSION } from "./text.ts";
import type { LawNormState } from "./types.ts";

const OLD_TEXT = "Шлюб розривається судом за заявою одного з подружжя.";
const NEW_TEXT = "Шлюб розривається судом за спільною заявою подружжя.";

async function fingerprintOf(text: string): Promise<string> {
  const result = await fingerprintRevision(text);
  if (!result.ok) throw new Error(`fixture is not fetchable text: ${result.reason}`);
  return result.revision.fingerprint;
}

/** A norm the fetcher has seen before and last agreed with. */
async function watched(overrides: Partial<ProbedNorm> = {}): Promise<ProbedNorm> {
  return {
    state: "verified",
    fingerprint: await fingerprintOf(OLD_TEXT),
    normalizerVersion: NORMALIZER_VERSION,
    previousText: OLD_TEXT,
    ...overrides,
  };
}

function probe(norm: ProbedNorm, text: string, hasOpenSignal = false): ProbeInput {
  return {
    norm,
    outcome: { kind: "fetched", text, publishedRevisionDate: "2026-08-01" },
    hasOpenSignal,
  };
}

describe("decideProbe — nothing usable came back (§9.15)", () => {
  // The condition that carries the whole build-rather-than-buy argument: every
  // way of failing lands on `unreachable`, and none of them lands on silence.
  const failures = [
    "transport",
    "http_status",
    "act_identity_moved",
    "heading_missing",
    "heading_mismatch",
    "revision_date_unparsable",
  ] as const;

  for (const failure of failures) {
    it(`turns ${failure} into unreachable and never into "no change"`, async () => {
      const decision = await decideProbe({
        norm: await watched(),
        outcome: { kind: "failed", failure },
        hasOpenSignal: false,
      });

      expect(decision.verdict).toBe("unreachable");
      expect(decision.state).toBe("unreachable");
      expect(decision.revision).toBeNull();
    });
  }

  // §9.10, stated as two fields that must disagree. A failed probe still counts
  // as a check — otherwise nothing distinguishes "we tried and could not" from
  // "we never tried", and staleness is computed from the second timestamp.
  it("records that a check happened and refuses to record a verification", async () => {
    const decision = await decideProbe({
      norm: await watched(),
      outcome: { kind: "failed", failure: "transport" },
      hasOpenSignal: false,
    });

    expect(decision.markChecked).toBe(true);
    expect(decision.markVerified).toBe(false);
  });

  // The assertion arrives from our own reduction rather than from the parser,
  // and it has to end in the same place. Empty markup is the canonical shape of
  // a parser that broke without erroring.
  it("treats an empty extraction as unreachable, not as an article", async () => {
    const decision = await decideProbe(probe(await watched(), "   \n  "));

    expect(decision.verdict).toBe("unreachable");
    expect(decision.markVerified).toBe(false);
    expect(decision.revision).toBeNull();
  });

  // A norm nobody can fetch has no diff to read, so it belongs on the health
  // screen and not in a queue with a one-business-day clock on it (§9.16).
  it("raises no triage signal, because there is nothing to triage", async () => {
    const decision = await decideProbe({
      norm: await watched(),
      outcome: { kind: "failed", failure: "http_status" },
      hasOpenSignal: false,
    });

    expect(decision.raiseSignal).toBe(false);
  });
});

describe("decideProbe — the ordinary cases", () => {
  it("verifies a norm whose text has not moved, and records no revision", async () => {
    const decision = await decideProbe(probe(await watched(), OLD_TEXT));

    expect(decision.verdict).toBe("unchanged");
    expect(decision.state).toBe("verified");
    expect(decision.markVerified).toBe(true);
    expect(decision.revision).toBeNull();
    expect(decision.raiseSignal).toBe(false);
  });

  // Reflow is the commonest false alarm available, and the reduction is what
  // makes it not one. Same law, different bytes, one fingerprint.
  it("does not call a reflowed page a change", async () => {
    // A non-breaking space where a space was, plus CRLF and indentation: the
    // publisher's typesetting moved and the law did not. Written by code point
    // because an invisible character pasted into a test is one an editor can eat
    // without the test noticing it has stopped asserting anything.
    const nbsp = String.fromCodePoint(0x00a0);
    const crlf = String.fromCodePoint(0x000d, 0x000a);
    const reflowed = `${crlf}   ${OLD_TEXT.replace(" ", nbsp)}   `;

    expect(reflowed).not.toContain(OLD_TEXT);

    const decision = await decideProbe(probe(await watched(), reflowed));

    expect(decision.verdict).toBe("unchanged");
    expect(decision.revision).toBeNull();
  });

  it("records a drift with its text, and does not mark it verified", async () => {
    const decision = await decideProbe(probe(await watched(), NEW_TEXT));

    expect(decision.verdict).toBe("drifted");
    expect(decision.state).toBe("drifted");
    expect(decision.markChecked).toBe(true);
    // The check succeeded and did *not* match, which is the distinction the two
    // timestamps exist to keep. Advancing this would render a moved article as
    // freshly confirmed.
    expect(decision.markVerified).toBe(false);
    expect(decision.revision).toEqual({
      revision: {
        text: NEW_TEXT,
        fingerprint: await fingerprintOf(NEW_TEXT),
        normalizerVersion: NORMALIZER_VERSION,
      },
      origin: "observed",
    });
    expect(decision.raiseSignal).toBe(true);
  });

  // Switching the fetcher on must not page a lawyer once per norm.
  it("learns what an article says without calling it an event", async () => {
    const fresh = await watched({ state: "unverified", fingerprint: null, previousText: null });
    const decision = await decideProbe(probe(fresh, OLD_TEXT));

    expect(decision.verdict).toBe("first_fetch");
    expect(decision.state).toBe("verified");
    expect(decision.markVerified).toBe(true);
    expect(decision.revision?.origin).toBe("observed");
    expect(decision.raiseSignal).toBe(false);
  });

  // §9.4's failure — a lawyer who stops opening alerts — is reached by
  // repeating a true alarm just as surely as by raising false ones.
  it("does not queue a second signal while the first is still waiting", async () => {
    const decision = await decideProbe(probe(await watched(), NEW_TEXT, true));

    expect(decision.verdict).toBe("drifted");
    // Still recorded: the history is what a diff is produced from later.
    expect(decision.revision).not.toBeNull();
    expect(decision.raiseSignal).toBe(false);
  });
});

describe("decideProbe — our rules moved, not the law's (§9.7)", () => {
  const OLDER_NORMALIZER = NORMALIZER_VERSION - 1;

  // The morning a normalizer is bumped, every norm's fingerprint differs from
  // the stored one. Without this branch that is two hundred drifts and two
  // hundred triage clocks, for nothing that happened in any law.
  it("calls an unchanged article a renormalization and pages nobody", async () => {
    const norm = await watched({
      normalizerVersion: OLDER_NORMALIZER,
      fingerprint: "sha256:" + "0".repeat(64), // produced by rules we no longer run
      previousText: OLD_TEXT,
    });

    const decision = await decideProbe(probe(norm, OLD_TEXT));

    expect(decision.verdict).toBe("renormalized");
    expect(decision.state).toBe("verified");
    expect(decision.markVerified).toBe(true);
    expect(decision.revision?.origin).toBe("renormalized");
    expect(decision.raiseSignal).toBe(false);
  });

  // The case that rules out inferring the label from the version having moved.
  // Both things happened; the legislative half is the half a lawyer must see.
  it("still reports a drift when the article changed as well", async () => {
    const norm = await watched({
      normalizerVersion: OLDER_NORMALIZER,
      fingerprint: "sha256:" + "0".repeat(64),
      previousText: OLD_TEXT,
    });

    const decision = await decideProbe(probe(norm, NEW_TEXT));

    expect(decision.verdict).toBe("drifted");
    expect(decision.state).toBe("drifted");
    expect(decision.revision?.origin).toBe("observed");
    expect(decision.raiseSignal).toBe(true);
  });

  // A fingerprint with no text behind it: a norm entered before the revision log
  // existed. The two cases genuinely cannot be told apart, so the branch picks
  // the survivable failure and says which branch it took.
  it("cannot tell them apart with no stored text, and errs towards the alarm", async () => {
    const norm = await watched({
      normalizerVersion: OLDER_NORMALIZER,
      fingerprint: "sha256:" + "0".repeat(64),
      previousText: null,
    });

    const decision = await decideProbe(probe(norm, OLD_TEXT));

    expect(decision.verdict).toBe("drifted_indeterminate");
    expect(decision.state).toBe("drifted");
    expect(decision.raiseSignal).toBe(true);
  });
});

describe("decideProbe — a person's judgement outranks the scheduler", () => {
  // The scenario worth reading twice. A lawyer confirmed an impact, which took a
  // published service off sale (Q5). The article has not moved since — of course
  // it has not, the amendment already landed — so the next probe matches. A
  // decision layer without this rule writes `verified`, and the service goes
  // back on sale hours later with nobody having decided anything.
  it("does not put a paused service back on sale by finding the text unchanged", async () => {
    const norm = await watched({ state: "impact_confirmed" });
    const decision = await decideProbe(probe(norm, OLD_TEXT));

    expect(decision.verdict).toBe("unchanged");
    expect(decision.state).toBe("impact_confirmed");
    expect(decision.stateChanged).toBe(false);
    expect(decision.heldByPerson).toBe(true);
  });

  it("does not settle a question a lawyer is still reading", async () => {
    const norm = await watched({ state: "under_review" });
    const decision = await decideProbe(probe(norm, OLD_TEXT));

    expect(decision.state).toBe("under_review");
    expect(decision.heldByPerson).toBe(true);
  });

  // Holding the state must not hide the failure. The timestamps still move, and
  // staleness is derived from `last_verified_at`, so the health screen sees it.
  it("holds the state and still records the failed check underneath it", async () => {
    const norm = await watched({ state: "impact_confirmed" });
    const decision = await decideProbe({
      norm,
      outcome: { kind: "failed", failure: "transport" },
      hasOpenSignal: false,
    });

    expect(decision.state).toBe("impact_confirmed");
    expect(decision.markChecked).toBe(true);
    expect(decision.markVerified).toBe(false);
    expect(decision.verdict).toBe("unreachable");
  });

  // And the evidence is still collected while a person holds the state — the
  // article moving again during a review is exactly what the reviewer needs.
  it("still records a new revision while a person holds the state", async () => {
    const norm = await watched({ state: "under_review" });
    const decision = await decideProbe(probe(norm, NEW_TEXT));

    expect(decision.state).toBe("under_review");
    expect(decision.revision?.origin).toBe("observed");
  });

  // The other half: a machine-set state is the scheduler's to move. Without
  // this the two rules are indistinguishable from "never change the state".
  const machineOwned: LawNormState[] = ["unverified", "verified", "drifted", "unreachable"];
  for (const state of machineOwned) {
    it(`moves a norm out of ${state}, which no person is holding`, async () => {
      const norm = await watched({ state });
      const decision = await decideProbe(probe(norm, NEW_TEXT));

      expect(decision.heldByPerson).toBe(false);
      expect(decision.state).toBe("drifted");
    });
  }
});
