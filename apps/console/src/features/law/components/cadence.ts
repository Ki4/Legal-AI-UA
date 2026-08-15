// Rendering a cadence, which arrives as a number of hours (see the generated
// column in the migration) and has to read as something a person says.
//
// Total, like every formatter on a screen with no `ErrorBoundary` (DoD §5): a
// cadence that is not a positive finite number renders as hours anyway, oddly,
// rather than throwing.

import type { PluralKey } from "@legal-ai/i18n";

const HOURS_PER_DAY = 24;

export interface CadencePhrase {
  key: PluralKey;
  count: number;
}

/**
 * Days when the hours divide evenly, hours otherwise — so 168 reads as "every 7
 * days" rather than as a number nobody converts in their head.
 *
 * Both branches return a counted phrase, which is why neither is a ternary in a
 * component: Ukrainian has three plural forms, and `кожні 2 дні` / `кожні 5
 * днів` differ (DoD §6).
 */
export function cadencePhrase(hours: number): CadencePhrase {
  if (!Number.isFinite(hours) || hours <= 0) {
    return { key: "law.cadence.everyHours", count: 0 };
  }

  if (hours % HOURS_PER_DAY === 0) {
    return { key: "law.cadence.everyDays", count: hours / HOURS_PER_DAY };
  }

  return { key: "law.cadence.everyHours", count: hours };
}
