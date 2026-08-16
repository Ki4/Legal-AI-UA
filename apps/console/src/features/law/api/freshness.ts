// §9.10, as a function: green must mean checked.
//
// "No difference found" and "no check completed" are different states. If a norm
// has not been *successfully* checked for several times its interval, that is an
// alarm in its own right, equal in weight to a detected change — because without
// it a broken fetcher looks exactly like perfect order, and the first to notice
// is a client.
//
// It lives beside the contract rather than in either implementation, because
// both have to answer this identically. A fixture that called a norm fresh where
// Postgres called it stale would be a screen built against a rule the real data
// does not follow.

import type { NormFreshness } from "./types";

/**
 * How many probe intervals may pass before verification is stale.
 *
 * §9.8 says "several times its interval" and does not name a number, so this is
 * a choice rather than a transcription. Three is the smallest count that does
 * not fire on ordinary noise — one missed probe is a retry, two is a bad
 * afternoon, three is a pattern — and it is deliberately independent of
 * `max_probe_interval`, which bounds how *often* we look rather than how long we
 * tolerate not having looked.
 */
export const STALE_AFTER_INTERVALS = 3;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Whether a norm's last successful verification still counts.
 *
 * Total (DoD §5). A nonsensical interval — zero, negative, not a number — is
 * treated as "cannot say when this goes stale", and the answer is `fresh` rather
 * than `stale`: an alarm raised by arithmetic nobody can explain is the kind
 * that gets ignored, and takes the real ones with it. The database refuses a
 * non-positive interval anyway (`law_norms_guard_cadence`), so this branch
 * guards data no writer can currently produce.
 */
export function freshnessOf(
  lastVerifiedAt: string | null,
  probeIntervalHours: number,
  now: number = Date.now(),
): NormFreshness {
  if (lastVerifiedAt === null) return { kind: "never_checked" };

  const verifiedAt = Date.parse(lastVerifiedAt);
  if (Number.isNaN(verifiedAt)) return { kind: "never_checked" };

  if (!Number.isFinite(probeIntervalHours) || probeIntervalHours <= 0) {
    return { kind: "fresh", verifiedAt: lastVerifiedAt };
  }

  const deadline = verifiedAt + probeIntervalHours * STALE_AFTER_INTERVALS * HOUR_MS;

  return now > deadline
    ? { kind: "stale", verifiedAt: lastVerifiedAt }
    : { kind: "fresh", verifiedAt: lastVerifiedAt };
}
