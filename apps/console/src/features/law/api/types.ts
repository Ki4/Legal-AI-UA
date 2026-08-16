// View models for the law register (§4.11) and a service's dependencies (§4.9).
//
// Rows are snake_case, these are camelCase, and the mapping between them is what
// this layer is for (ADR-0012).

import type { LawNormScope, LawNormState, LawSource } from "@legal-ai/db";

/**
 * §9.10: "no difference found" and "no check completed" are different states and
 * must never render alike. Without this, a broken fetcher looks exactly like
 * perfect order and the first to notice is a client.
 *
 * Derived rather than stored, which is why `law_norm_state` has six values and
 * §9.11's table has eight — a column holding this would be a copy of
 * `last_verified_at` plus an interval, drifting from both.
 *
 * Three variants rather than a nullable date, because a date that is null for
 * "never checked" and old for "overdue" is one field saying two things (DoD §5).
 */
export type NormFreshness =
  /** Entered, never successfully checked. Today this is every norm. */
  | { kind: "never_checked" }
  | { kind: "fresh"; verifiedAt: string }
  /** Nothing was detected, and verification is older than policy allows. */
  | { kind: "stale"; verifiedAt: string };

/** A service that rests on a norm. The other half of "watched once" (§9.3). */
export interface NormDependent {
  serviceId: string;
  serviceTitle: string;
}

export interface LawNormListItem {
  id: string;
  source: LawSource;
  actId: string;
  actTitle: string;
  scope: LawNormScope;
  /** Null exactly when the scope is the whole act (§9.4). */
  article: string | null;
  /** Present exactly when the scope is the whole act, and never empty. */
  actScopeReason: string | null;
  /** What the lawyer pasted. Kept for recognition, never fetched (§9.2). */
  sourceUrl: string;
  /** The "currently in force" pointer — what a fetcher would ask for. */
  canonicalUrl: string;
  state: LawNormState;
  freshness: NormFreshness;
  /**
   * Hours rather than an interval string, because that is what the column
   * hands over — see the generated column in the migration.
   */
  probeIntervalHours: number;
  intervalReason: string | null;
  lastCheckedAt: string | null;
  lastVerifiedAt: string | null;
  /**
   * Every service resting on this norm, this one included when read from a
   * service's own tab. §9.3's point is only visible if a lawyer editing a norm
   * can see who else it reaches.
   */
  dependents: NormDependent[];
}

export interface ServiceLawRef {
  id: string;
  /** §9.5.6. Never empty — the column refuses it. */
  reliedOn: string;
  norm: LawNormListItem;
}

export interface ServiceLawPage {
  serviceId: string;
  serviceTitle: string;
  refs: ServiceLawRef[];
}

/**
 * What the entry form collects (§9.5).
 *
 * `actTitle` is typed by the lawyer, and that is a consequence of shipping
 * before the fetcher: with one, the title would be read from the page along
 * with the text the lawyer confirms (§9.5.7, ADM-42). It is ignored when the
 * norm is already in the register — the first person to enter it named it.
 */
export interface NewLawReference {
  serviceId: string;
  /** Pasted, normalized on arrival. Anything the parser refuses never gets here. */
  url: string;
  actTitle: string;
  /** Null means the dependency is on the whole act, which then needs a reason. */
  article: string | null;
  actScopeReason: string | null;
  reliedOn: string;
}

export interface CadenceChange {
  normId: string;
  hours: number;
  /** Required by the database whenever the new value is not the recommendation. */
  reason: string | null;
}
