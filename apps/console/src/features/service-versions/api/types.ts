// This feature's own view model (ADR-0012, convention 6). The card and the list
// each carry a `currentVersion`; this screen carries *every* version with the
// three names §4.3 asks for, and shares none of it with them — a table row and
// a card summary that drag each other along is the coupling the convention
// forbids.

import type {
  GenerationMode,
  PauseReason,
  PauseResolution,
  ReviewMode,
  ServiceStatus,
} from "@legal-ai/db";

export type {
  GenerationMode,
  PauseReason,
  PauseResolution,
  ReviewMode,
  ServiceStatus,
} from "@legal-ai/db";

/**
 * A member of staff as a version names them. Same rule as everywhere else, and
 * stated in full because it may not be imported from a sibling: `fullName` is
 * null when the row points at somebody whose profile could not be read — a
 * deactivated account, or one RLS hides — which is not the same as nobody.
 */
export interface StaffRef {
  id: string;
  fullName: string | null;
}

/**
 * The professional act (ADR-0027). Three shapes, not two nullable columns:
 *
 * - `none` — nobody has signed.
 * - `signed` — a signatory's name and date, and whether the four-eyes rule
 *   could be applied. `selfReleased` is a flag rather than a refusal because
 *   a firm with one lawyer in the area has nobody else to ask.
 * - `unsigned` — `released_at` without `released_by`: a version put on sale
 *   before the rule existed. The migration stamped the date and left the name
 *   empty on purpose, and the screen has to say that rather than borrow the
 *   admin's name or render it as "not released".
 */
export type Release =
  | { kind: "none" }
  | { kind: "signed"; by: StaffRef; at: string; selfReleased: boolean }
  | { kind: "unsigned"; at: string };

/** The commercial act: who put it on sale and when. Null until somebody has. */
export interface Sale {
  by: StaffRef | null;
  at: string;
}

/**
 * How a pause ended. `newVersion` names the fix that closed it — that is the
 * one resolution nobody types (§5.7).
 */
export type PauseOutcome =
  | { kind: "open" }
  | {
      kind: "closed";
      at: string;
      by: StaffRef | null;
      resolution: PauseResolution;
      replacedByVersion: number | null;
    };

export interface PauseItem {
  id: string;
  reason: PauseReason;
  /** Internal, never client-facing (§5.7). */
  note: string | null;
  openedBy: StaffRef | null;
  openedAt: string;
  outcome: PauseOutcome;
}

export interface VersionItem {
  id: string;
  version: number;
  status: ServiceStatus;
  generationMode: GenerationMode;
  reviewMode: ReviewMode;
  priceMinor: number | null;
  currency: string | null;
  createdAt: string;
  /** Null for versions older than `created_by` — the column was added on 2026-09-18. */
  author: StaffRef | null;
  release: Release;
  sale: Sale | null;
  /** The open pause, if the version is paused. The schema allows one. */
  openPause: PauseItem | null;
  /** Every pause this version ever had, newest first. */
  pauses: PauseItem[];
}

/** Who may sign for the service's practice area (§5.6). */
export interface Signatory {
  lawyer: StaffRef;
  isHead: boolean;
}

export interface PracticeAreaRef {
  code: string;
  labels: { uk: string; en: string };
}

export interface ServiceVersionsPage {
  service: {
    id: string;
    title: string;
    /**
     * Null when the code resolves to no reference row — the same case the
     * catalogue renders as the raw code, and the same reason: a fixture and an
     * embed can both come back empty.
     */
    practiceArea: PracticeAreaRef | null;
    practiceAreaCode: string;
  };
  /** Newest first. */
  versions: VersionItem[];
  signatories: Signatory[];
  /**
   * Lawyers attached to the service. Ids and the accountable flag only: the
   * screen needs them to know whether the viewer may author (any assignment)
   * or pause (the accountable one); the names belong to the card.
   */
  assignments: Assignment[];
}

export interface Assignment {
  lawyerId: string;
  isPrimary: boolean;
}

/** What a pause is opened with. The rest is the database's. */
export interface PauseInput {
  reason: PauseReason;
  note: string | null;
}

/** The two ways a person closes a pause. `new_version` is not offered. */
export type LiftResolution = Extract<PauseResolution, "resumed" | "archived">;
