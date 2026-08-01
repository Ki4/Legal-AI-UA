/** Joins class-name fragments, dropping falsy values. No specificity merging —
 * components in this package never emit conflicting utilities for the same
 * property, so a plain join is enough (no need for a tailwind-merge dependency). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
