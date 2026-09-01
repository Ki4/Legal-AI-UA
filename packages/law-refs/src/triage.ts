// What a lawyer's triage decision obliges (spec §9.11, §9.16, and Q5-Q8 in §14).
//
// `probe.ts` ends where a machine's competence ends: it can say the text moved,
// and it cannot say whether that matters. This is the other half — a lawyer has
// read the diff and chosen, and these are the consequences that follow from the
// choice rather than from anybody remembering them.
//
// **Why this is a pure function and not four lines in a click handler.** The
// consequences of "impact confirmed" are the most expensive thing this product
// does: a service comes off sale, every client holding an issued document is
// told their document is wrong, and a remediation clock starts. Four
// stakeholders, three of them outside the building. Rules that costly cannot
// live only in a screen, because a screen is the one place they cannot be run
// against a table of scenarios.
//
// **What it deliberately does not do is deliver anything.** §10 defers
// client-facing notification until `apps/web` and real orders exist, and that
// sequencing is not something to quietly overtake. So this returns *who is owed
// what, and when* — an obligation, in a shape a delivery channel can later read
// — and sends nothing. The obligation existing before the channel does is the
// point: a promise of freshness with no record of who was owed it is §8.5's
// complaint one layer down.

import type { LawNormState } from "./types.ts";

/**
 * ISO `yyyy-mm-dd`, which is the only shape the comparisons below are correct
 * for. Deliberately a shape check and not a calendar check: `2026-02-31` passes
 * here and is somebody else's problem, while `30.08.2026` is this module's.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** The lawyer's choice at triage. §9.16: it is small work, and there are two answers. */
export type TriageChoice =
  | {
      /**
       * Changed, and it does not touch what the service relies on (§9.11).
       *
       * The path that carries more weight than it looks: most amendments to a
       * large code do not touch the provision a template rests on, and if every
       * drift forced a template update the system would become a source of false
       * alarms. It is one click, and it is still a legal judgement recorded with
       * its author.
       */
      outcome: "no_impact";
      note: string;
    }
  | {
      /** It changes the document; a new template version is owed. */
      outcome: "impact";
      /**
       * §9.16, and the reason it is set here rather than fixed in policy: only
       * the person who has read the diff can judge severity, and a law taking
       * effect in three months is not the same urgency as one that made
       * yesterday's delivered document wrong.
       */
      remediationDue: string;
      note: string;
    };

export interface TriagedSignal {
  /**
   * The date the amending act takes effect, when it stated one (§9.9).
   *
   * ISO `yyyy-mm-dd`. Null when the change is already in force, which is the
   * ordinary case — and non-null is where the largest practical win in §9 lives.
   */
  effectiveDate: string | null;
}

/** Who is owed a message. Not a channel, and not a template — an audience. */
export type NotifiedParty =
  /** The lawyers answerable for the affected services (§9.1). */
  | "accountable_lawyers"
  /** Q5's "a named few beyond them": the standing watchers of law changes. */
  | "law_change_watchers"
  /**
   * Clients holding an already-issued document that rests on this norm.
   *
   * Derived through the reverse index of §8.1 — norm to blocks to versions to
   * issued documents to clients — never stored as a list. Q8 needs that index
   * built regardless, which is why the audience is a query rather than a table.
   */
  | "holders_of_issued_documents";

export type NotifyWhen =
  | { kind: "immediately" }
  /** Q7: a change that has not taken effect reaches the client on the day. */
  | { kind: "on_date"; date: string };

export interface OwedNotification {
  party: NotifiedParty;
  when: NotifyWhen;
  /**
   * A dictionary key, never a sentence.
   *
   * The root `CLAUDE.md` rule: every user-visible string is written for both
   * languages from the first line, because which states exist and what each one
   * says are decisions the copy makes. A module that returned Ukrainian prose
   * would be a screen rewritten the day English arrives.
   */
  messageKey: string;
}

/**
 * What the intake bot says while a service is paused (Q5).
 *
 * A pause the product does not explain reads as a product that is broken. This
 * carries the four things Q5's answer asked for — that it is temporary, which
 * act did it, when that act is dated, and the two ways forward — as parameters
 * to a key, so the sentence itself lives in `packages/i18n`.
 */
export interface IntakeNotice {
  messageKey: string;
  params: {
    actTitle: string;
    actDate: string | null;
  };
  /** The slower, dearer way forward Q5 asked to be offered by name. */
  offersDirectLawyer: true;
}

export interface TriageDecision {
  /** What `law_signals.state` becomes. */
  signalState: "resolved_no_impact" | "impact_confirmed" | "scheduled";
  /** What `law_norms.state` becomes. */
  normState: LawNormState;
  /** Q5. The most expensive consequence in the product, so it is a field and not a side effect. */
  pausesPublishedServices: boolean;
  /** Q6 and Q7, as obligations rather than deliveries. */
  notifications: OwedNotification[];
  /**
   * Q8, as a value rather than an absence.
   *
   * Written down because "we did not build automatic re-issue" and "we decided
   * against automatic re-issue" are different facts, and only the second
   * survives somebody later reading §8.4 and assuming the gap is an oversight.
   */
  reIssue: "human_decides";
  /** Non-null exactly when the service is paused. */
  intakeNotice: IntakeNotice | null;
  /**
   * §9.16's tracked date, carried through so that everything the caller must
   * write is in one returned object. Null when nothing is owed.
   */
  remediationDue: string | null;
}

/**
 * Why a triage choice was refused.
 *
 * The same shape as every other decision in this package, and for the same
 * reason: the caller has to open the result to reach the decision, so a refusal
 * cannot be walked past. Both values are dates that would be false the moment
 * they were written down, which is the one thing a deadline may not be.
 */
export type TriageRejection =
  /**
   * A date arrived in a shape this module cannot compare.
   *
   * Every comparison here is a string comparison, which is correct for ISO
   * `yyyy-mm-dd` and quietly wrong for anything else: `30.08.2026` sorts before
   * `2026-09-01` and would schedule a change that has already landed, or pause a
   * service for one that has not. The most expensive decision in the product
   * should not rest on an assumption about a caller's date format, so the
   * assumption is checked.
   */
  | "malformed_date"
  /** A deadline already missed at the moment it is set is not a deadline. */
  | "remediation_due_in_the_past"
  /**
   * A fix due after the law lands means the service is knowingly wrong on the
   * day it starts being wrong — which is the single day §9.9 exists to let us
   * get ahead of.
   */
  | "remediation_due_after_effective_date";

export type TriageResult =
  { ok: true; decision: TriageDecision } | { ok: false; reason: TriageRejection };

export interface TriageInput {
  signal: TriagedSignal;
  choice: TriageChoice;
  /** The act behind the change, for the sentence a caller is shown. */
  act: { title: string; date: string | null };
  /** Today, as ISO `yyyy-mm-dd`. Passed in so the decision is a function of its inputs. */
  today: string;
}

/**
 * Decide what a triage choice obliges.
 *
 * Total: every branch returns a full set of consequences, so "we forgot to
 * notify anybody in this case" is a visibly empty array rather than an absent
 * code path.
 */
export function decideTriage(input: TriageInput): TriageResult {
  const { signal, choice, act, today } = input;

  const dates = [
    today,
    signal.effectiveDate,
    choice.outcome === "impact" ? choice.remediationDue : null,
  ];
  if (dates.some((date) => date !== null && !ISO_DATE.test(date))) {
    return { ok: false, reason: "malformed_date" };
  }

  if (choice.outcome === "no_impact") {
    return ok({
      signalState: "resolved_no_impact",
      // §9.11: the definition of `no impact` ends "re-fingerprint and continue",
      // after which the fingerprint matches and the norm is `verified` by
      // definition. Storing a separate `no impact` state would be two
      // simultaneously-true states, which §6.1 refuses.
      normState: "verified",
      pausesPublishedServices: false,
      // Nobody outside the building hears about an amendment that does not
      // touch what we sold. Telling clients anyway is how a freshness promise
      // becomes noise a client learns to ignore.
      notifications: [],
      reIssue: "human_decides",
      intakeNotice: null,
      remediationDue: null,
    });
  }

  if (choice.remediationDue < today) {
    return { ok: false, reason: "remediation_due_in_the_past" };
  }

  const notYetInForce = signal.effectiveDate !== null && signal.effectiveDate > today;

  if (notYetInForce) {
    if (choice.remediationDue > (signal.effectiveDate as string)) {
      return { ok: false, reason: "remediation_due_after_effective_date" };
    }

    // The interaction Q5 and Q7 would otherwise have created, settled in §14: a
    // future-dated change is `scheduled` and not `impact_confirmed`, so it does
    // **not** pause anything. The service sells until the date; §9.9's whole
    // win is that the lawyer prepares the new version before then rather than
    // catching up afterwards.
    return ok({
      signalState: "scheduled",
      // Not `impact_confirmed`, which would pause, and not `drifted`, which
      // would claim nobody has looked. The register agrees with the publisher
      // about the text in force today, so `verified` is the honest word — and
      // the pending change lives on the signal, which is the only place it can
      // live without being in two.
      normState: "verified",
      pausesPublishedServices: false,
      notifications: [
        {
          party: "accountable_lawyers",
          when: { kind: "immediately" },
          messageKey: "law.signal.scheduled.lawyer",
        },
        {
          party: "law_change_watchers",
          when: { kind: "immediately" },
          messageKey: "law.signal.scheduled.watcher",
        },
        {
          party: "holders_of_issued_documents",
          // Q7, answered against the friendlier option on purpose: telling a
          // client about a rule that does not yet apply invites them to act on
          // it early.
          when: { kind: "on_date", date: signal.effectiveDate as string },
          messageKey: "law.signal.scheduled.client",
        },
      ],
      reIssue: "human_decides",
      intakeNotice: null,
      remediationDue: choice.remediationDue,
    });
  }

  return ok({
    signalState: "impact_confirmed",
    normState: "impact_confirmed",
    pausesPublishedServices: true,
    notifications: [
      {
        party: "accountable_lawyers",
        when: { kind: "immediately" },
        messageKey: "law.signal.impact.lawyer",
      },
      {
        party: "law_change_watchers",
        when: { kind: "immediately" },
        messageKey: "law.signal.impact.watcher",
      },
      {
        party: "holders_of_issued_documents",
        // Q6. Not when the fix ships: §9.16 allows remediation up to a week, and
        // that is a week in which somebody may file a document we already know
        // is wrong. It costs a second message and closes the window.
        when: { kind: "immediately" },
        messageKey: "law.signal.impact.client",
      },
    ],
    reIssue: "human_decides",
    intakeNotice: {
      messageKey: "law.service.paused",
      params: { actTitle: act.title, actDate: act.date },
      offersDirectLawyer: true,
    },
    remediationDue: choice.remediationDue,
  });
}

function ok(decision: TriageDecision): TriageResult {
  return { ok: true, decision };
}
