// Which acts a version offers the person looking at it.
//
// Presentation, not access control (DoD §7). Every rule below is enforced by a
// policy, a guard or the release RPC, and this function only avoids offering
// an act the database would refuse — so the screen does not tell an admin they
// may sign, or a lawyer they may sell. It is pure so the table of who-may-what
// in ADR-0027 and §5.7 can be asserted line by line without a browser.
//
// It reads the same facts the schema reads: the role from the token, the
// caller's id against `service_assignments` and `practice_area_signatories`,
// and the version's own columns. Where the schema knows something this layer
// cannot — an order's reviewer may pause for `generation` — the act is simply
// not offered, which is the safe direction.

import type { PauseReason, Role } from "@legal-ai/db";
import type { ServiceVersionsPage, VersionItem } from "./types";

export interface Viewer {
  userId: string | null;
  role: Role | null;
}

export type VersionAction =
  | { kind: "submitForReview" }
  | { kind: "returnToDraft" }
  /** `self`: the viewer authored it and is the area's only signatory — allowed, and flagged. */
  | { kind: "release"; self: boolean }
  | { kind: "putOnSale" }
  | { kind: "pause"; reasons: readonly PauseReason[] }
  | { kind: "lift"; pauseId: string };

/** The reasons a lawyer may open; `commercial` is the admin's alone (§5.7). */
const PROFESSIONAL_REASONS: readonly PauseReason[] = [
  "law_impact",
  "defect",
  "generation",
  "no_reviewer",
];
const ALL_REASONS: readonly PauseReason[] = [...PROFESSIONAL_REASONS, "commercial"];

export function availableActions(
  version: VersionItem,
  page: Pick<ServiceVersionsPage, "signatories" | "assignments">,
  viewer: Viewer,
): VersionAction[] {
  const { userId, role } = viewer;
  if (userId === null || role === null) return [];

  const isAdmin = role === "admin";
  const isLawyer = role === "lawyer";
  const isAssigned = isLawyer && page.assignments.some((a) => a.lawyerId === userId);
  const isAccountable =
    isLawyer && page.assignments.some((a) => a.lawyerId === userId && a.isPrimary);
  const signs = isLawyer && page.signatories.some((s) => s.lawyer.id === userId);
  const othersSign = page.signatories.some((s) => s.lawyer.id !== userId);

  const actions: VersionAction[] = [];
  const onSale = version.sale !== null;

  // The author's act: any assigned lawyer, before publication. The policy
  // fences `status` to draft and in_review and `published_at` to null.
  if (isAssigned && !onSale) {
    if (version.status === "draft") actions.push({ kind: "submitForReview" });
    if (version.status === "in_review") actions.push({ kind: "returnToDraft" });
  }

  // The professional act: a signatory of the area, on a version in review
  // that nobody has signed. The author is refused while the area has another
  // signatory (ADR-0027 §3); alone, allowed and flagged.
  if (signs && !onSale && version.status === "in_review" && version.release.kind === "none") {
    const self = version.author?.id === userId;
    if (!self || !othersSign) actions.push({ kind: "release", self });
  }

  // The commercial act: an admin, on a released version. `unsigned` counts —
  // it is the legacy row, already sold, and cannot reach here with `sale`
  // null; listed for completeness of the union rather than as a path.
  if (isAdmin && !onSale && version.status === "in_review" && version.release.kind !== "none") {
    actions.push({ kind: "putOnSale" });
  }

  // Stopping is wider than starting (§5.7). Admin: any reason. A signatory or
  // the accountable lawyer: the professional ones.
  if (version.status === "published" && version.openPause === null) {
    if (isAdmin) actions.push({ kind: "pause", reasons: ALL_REASONS });
    else if (signs || isAccountable) actions.push({ kind: "pause", reasons: PROFESSIONAL_REASONS });
  }

  // Lifting: a commercial pause is the admin's; a professional one is lifted
  // by a signatory or by the fix going on sale — never by an admin.
  if (version.openPause !== null) {
    const commercial = version.openPause.reason === "commercial";
    if ((commercial && isAdmin) || (!commercial && signs)) {
      actions.push({ kind: "lift", pauseId: version.openPause.id });
    }
  }

  return actions;
}
