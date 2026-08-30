import { describe, expect, it } from "vitest";
import { decideTriage } from "./triage.ts";
import type { TriageDecision, TriageInput, TriageResult } from "./triage.ts";

const TODAY = "2026-08-30";
const ACT = { title: "Про виконавче провадження", date: "2026-08-01" };

function triage(overrides: Partial<TriageInput> = {}): TriageResult {
  return decideTriage({
    signal: { effectiveDate: null },
    choice: { outcome: "impact", remediationDue: "2026-09-04", note: "Article 26 widened." },
    act: ACT,
    today: TODAY,
    ...overrides,
  });
}

function decided(result: TriageResult): TriageDecision {
  if (!result.ok) throw new Error(`expected a decision, got ${result.reason}`);
  return result.decision;
}

function partiesOf(decision: TriageDecision): string[] {
  return decision.notifications.map((notification) => notification.party).sort();
}

describe("decideTriage — no impact (§9.11)", () => {
  const decision = decided(triage({ choice: { outcome: "no_impact", note: "Renumbering only." } }));

  it("returns the norm to verified rather than inventing a second true state", () => {
    expect(decision.signalState).toBe("resolved_no_impact");
    expect(decision.normState).toBe("verified");
  });

  it("keeps the service on sale", () => {
    expect(decision.pausesPublishedServices).toBe(false);
    expect(decision.intakeNotice).toBeNull();
  });

  // Most amendments to a large code do not touch the provision a template rests
  // on. Telling clients about those is how a freshness promise turns into noise
  // a client learns to ignore — the §9.4 failure, arriving through the outbox.
  it("tells nobody, inside the building or outside it", () => {
    expect(decision.notifications).toEqual([]);
  });

  it("owes no remediation date", () => {
    expect(decision.remediationDue).toBeNull();
  });
});

describe("decideTriage — impact already in force (Q5, Q6)", () => {
  const decision = decided(triage());

  it("pauses the published service", () => {
    expect(decision.signalState).toBe("impact_confirmed");
    expect(decision.normState).toBe("impact_confirmed");
    expect(decision.pausesPublishedServices).toBe(true);
  });

  // Q5's answer asked for the pause to be spoken, with the act named and dated
  // and both ways forward offered. A pause the product does not explain reads as
  // a product that is broken.
  it("gives the intake bot something to say, naming and dating the act", () => {
    expect(decision.intakeNotice).toEqual({
      messageKey: "law.service.paused",
      params: { actTitle: ACT.title, actDate: ACT.date },
      offersDirectLawyer: true,
    });
  });

  it("owes a message to the lawyers, the watchers and the document holders", () => {
    expect(partiesOf(decision)).toEqual([
      "accountable_lawyers",
      "holders_of_issued_documents",
      "law_change_watchers",
    ]);
  });

  // Q6, answered against the friendlier option: §9.16 allows remediation up to a
  // week, and that is a week in which somebody may file a document we already
  // know is wrong.
  it("tells the holders of issued documents now, not when the fix ships", () => {
    const client = decision.notifications.find(
      (notification) => notification.party === "holders_of_issued_documents",
    );

    expect(client?.when).toEqual({ kind: "immediately" });
  });

  it("carries the remediation date the lawyer set (§9.16)", () => {
    expect(decision.remediationDue).toBe("2026-09-04");
  });

  // Q8, asserted rather than left as an absence: "we did not build it" and "we
  // decided against it" are different facts and only the second survives a later
  // reader of §8.4.
  it("re-issues nothing by itself", () => {
    expect(decision.reIssue).toBe("human_decides");
  });

  it("returns a message key rather than a sentence, in every notification", () => {
    for (const notification of decision.notifications) {
      expect(notification.messageKey).toMatch(/^law\./u);
    }
  });
});

describe("decideTriage — impact that has not taken effect yet (Q7, §9.9)", () => {
  const EFFECTIVE = "2026-11-01";
  const decision = decided(
    triage({
      signal: { effectiveDate: EFFECTIVE },
      choice: {
        outcome: "impact",
        remediationDue: "2026-10-15",
        note: "Takes effect in November.",
      },
    }),
  );

  // The interaction Q5 and Q7 would otherwise have created. A future-dated
  // change is `scheduled`, not `impact_confirmed`, so nothing comes off sale:
  // the service sells until the date, and §9.9's win is that the lawyer prepares
  // the new version before then rather than catching up afterwards.
  it("does not pause a service for a law that is not in force", () => {
    expect(decision.signalState).toBe("scheduled");
    expect(decision.pausesPublishedServices).toBe(false);
    expect(decision.intakeNotice).toBeNull();
  });

  // Not `impact_confirmed`, which would pause, and not `drifted`, which would
  // claim nobody has looked. The register agrees with the publisher about the
  // text in force today; the pending change lives on the signal.
  it("leaves the norm verified, because the register and the publisher agree today", () => {
    expect(decision.normState).toBe("verified");
  });

  it("tells the lawyers immediately, because preparing early is the whole win", () => {
    const lawyers = decision.notifications.find(
      (notification) => notification.party === "accountable_lawyers",
    );

    expect(lawyers?.when).toEqual({ kind: "immediately" });
  });

  // Q7, answered against advance notice on purpose: telling a client about a
  // rule that does not yet apply invites them to act on it early.
  it("holds the client message until the day the law lands", () => {
    const client = decision.notifications.find(
      (notification) => notification.party === "holders_of_issued_documents",
    );

    expect(client?.when).toEqual({ kind: "on_date", date: EFFECTIVE });
  });
});

describe("decideTriage — the two dates that would be false when written", () => {
  it("refuses a remediation date that has already passed", () => {
    expect(
      triage({
        choice: { outcome: "impact", remediationDue: "2026-08-29", note: "Yesterday." },
      }),
    ).toEqual({ ok: false, reason: "remediation_due_in_the_past" });
  });

  // A fix due after the law lands means the service is knowingly wrong on the
  // one day §9.9 exists to let us get ahead of.
  it("refuses a fix due after the law it is fixing takes effect", () => {
    expect(
      triage({
        signal: { effectiveDate: "2026-11-01" },
        choice: { outcome: "impact", remediationDue: "2026-11-02", note: "A day late." },
      }),
    ).toEqual({ ok: false, reason: "remediation_due_after_effective_date" });
  });

  // Both halves, one day apart. A rule that refused the effective date itself
  // would be a rule nobody could satisfy on a tight amendment.
  it("accepts a fix due on the effective date itself", () => {
    const result = triage({
      signal: { effectiveDate: "2026-11-01" },
      choice: { outcome: "impact", remediationDue: "2026-11-01", note: "On the day." },
    });

    expect(decided(result).signalState).toBe("scheduled");
  });

  it("accepts a remediation date of today", () => {
    const result = triage({
      choice: { outcome: "impact", remediationDue: TODAY, note: "Today." },
    });

    expect(decided(result).remediationDue).toBe(TODAY);
  });

  // The date rules are about impact. Declining to see one is not a deadline at
  // all, and asking for a date there would be asking a lawyer to schedule the
  // work they just decided is unnecessary.
  it("asks no date of a lawyer who found no impact", () => {
    const result = triage({ choice: { outcome: "no_impact", note: "Editorial." } });

    expect(result.ok).toBe(true);
  });
});

describe("decideTriage — a date it cannot compare", () => {
  // Every comparison in this module is a string comparison, correct for ISO and
  // quietly wrong for anything else. `30.08.2026` sorts before `2026-09-01`, so
  // an unchecked one would schedule a change that has already landed — or pause
  // a live service for one that has not.
  it("refuses a day-first date rather than comparing it", () => {
    expect(triage({ signal: { effectiveDate: "30.08.2026" } })).toEqual({
      ok: false,
      reason: "malformed_date",
    });
  });

  it("checks the remediation date and today as well, not only the effective date", () => {
    expect(
      triage({ choice: { outcome: "impact", remediationDue: "04/09/2026", note: "Slashes." } }),
    ).toEqual({ ok: false, reason: "malformed_date" });

    expect(triage({ today: "yesterday" })).toEqual({ ok: false, reason: "malformed_date" });
  });

  // The other half: a null effective date is the ordinary case — the change is
  // already in force — and must not be mistaken for a malformed one.
  it("accepts an absent effective date, which is not a malformed one", () => {
    expect(triage({ signal: { effectiveDate: null } }).ok).toBe(true);
  });
});

describe("decideTriage — the same change, before and after its effective date", () => {
  // One input differing by one day either side of the boundary, because the two
  // outcomes must not be reachable by accident. This is the pair that decides
  // whether a service is on sale.
  const signal = { effectiveDate: "2026-09-01" };
  const choice = { outcome: "impact", remediationDue: "2026-09-01", note: "Same change." } as const;

  it("does not pause the day before, and does pause the day it lands", () => {
    const before = decided(decideTriage({ signal, choice, act: ACT, today: "2026-08-31" }));
    const onTheDay = decided(decideTriage({ signal, choice, act: ACT, today: "2026-09-01" }));

    expect(before.pausesPublishedServices).toBe(false);
    expect(before.signalState).toBe("scheduled");

    expect(onTheDay.pausesPublishedServices).toBe(true);
    expect(onTheDay.signalState).toBe("impact_confirmed");
  });
});
