// The single source of truth for which languages exist (ADR-0006, design spec
// §13). Adding one is a line here plus a dictionary folder; removing one is the
// same edit backwards, which is the property the ADR asked for.
//
// The prohibition that makes it work: no locale literal appears anywhere else.
// A `if (locale === "uk")` branch in a component is how a language stops being
// data and becomes code, and then removing it stops being a one-line change.

export const LOCALES = ["uk", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Ukrainian, because the people using this are Ukrainian — lawyers in the
 * console, clients on the platform. The repository is English (root
 * `CLAUDE.md`); the product is not, and the two facts are unrelated.
 */
export const DEFAULT_LOCALE: Locale = "uk";

/**
 * What the switcher renders. Text codes, never flags: a language is not a
 * country, and here specifically that mapping is politically loaded (ADR-0006).
 *
 * The endonym rather than the English name — somebody looking for their own
 * language looks for the word they call it.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  uk: "Українська",
  en: "English",
};

/**
 * The BCP 47 tag for `Intl`. Separate from the locale code because they are
 * separate things: `uk` is which dictionary to read, `uk-UA` is which
 * conventions to format money and dates by, and a product could one day want
 * Ukrainian text with a different regional format.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  uk: "uk-UA",
  en: "en-GB",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
