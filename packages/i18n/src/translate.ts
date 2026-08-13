// The translation core. No React here on purpose: the rules below are testable
// as functions, and a rendering test would be a slower way to check the same
// thing.

import { en, enPlurals } from "./dictionaries/en";
import { uk, ukPlurals } from "./dictionaries/uk";
import type { Dictionary, PluralDictionary, PluralKey, TranslationKey } from "./dictionaries/uk";
import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from "./locales";

const DICTIONARIES: Record<Locale, Dictionary> = { uk, en };
const PLURAL_DICTIONARIES: Record<Locale, PluralDictionary> = { uk: ukPlurals, en: enPlurals };

export type TranslationParams = Record<string, string | number>;

/**
 * `{name}` placeholders, replaced from `params`.
 *
 * A placeholder with no matching parameter is left standing rather than
 * silently blanked: `Hello {name}` on screen is a bug somebody reports, and
 * `Hello ` is a bug somebody squints at.
 */
function interpolate(template: string, params?: TranslationParams): string {
  if (params === undefined) return template;

  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key];
    return value === undefined ? whole : String(value);
  });
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const template = DICTIONARIES[locale][key];

  // Unreachable through the type system, which is the point: this exists for
  // the day a dictionary is loaded from somewhere the compiler cannot see.
  // Falling back to the default locale shows the wrong language; showing the
  // key shows nothing at all, and the first is recoverable by a reader.
  if (template === undefined) return DICTIONARIES[DEFAULT_LOCALE][key] ?? key;

  return interpolate(template, params);
}

/**
 * A counted phrase, in the form the locale's own rules pick.
 *
 * `Intl.PluralRules` decides which form applies, so no language is named here.
 * Ukrainian resolving `2` to `few` and `5` to `many` is data the platform
 * already knows; a hand-written `count === 1` at a call site is a rule invented
 * for English and applied to everything.
 */
export function translatePlural(
  locale: Locale,
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  const forms = PLURAL_DICTIONARIES[locale][key];
  const category = new Intl.PluralRules(INTL_LOCALES[locale]).select(count);
  const template = forms[category] ?? forms.other;

  return interpolate(template, { count, ...params });
}
