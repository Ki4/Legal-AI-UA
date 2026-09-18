export {
  LOCALES,
  LOCALE_LABELS,
  INTL_LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "./locales";

export { translate, translatePlural, TRANSLATION_KEYS, type TranslationParams } from "./translate";

export { I18nProvider, useI18n, type I18nValue } from "./react";

export type { TranslationKey, PluralKey } from "./dictionaries/uk";
