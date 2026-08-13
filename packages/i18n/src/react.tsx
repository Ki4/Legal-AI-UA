import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PluralKey, TranslationKey } from "./dictionaries/uk";
import { DEFAULT_LOCALE, INTL_LOCALES, isLocale, type Locale } from "./locales";
import { translate, translatePlural, type TranslationParams } from "./translate";

const STORAGE_KEY = "legal-ai-locale";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** A plain string. */
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** A counted phrase — the form is the locale's business, not the caller's. */
  tCount: (key: PluralKey, count: number, params?: TranslationParams) => string;
  /** The BCP 47 tag for `Intl`, so money and dates follow the chosen language. */
  intlLocale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The stored preference, or the default.
 *
 * Deliberately not the browser's `navigator.language`. The console's users are
 * Ukrainian lawyers whose browsers are frequently in English for unrelated
 * reasons, so guessing from the browser would show the wrong language to
 * exactly the audience the default was chosen for. An explicit choice is
 * remembered; no choice means Ukrainian.
 */
function storedLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    // Private mode, or storage disabled. Not a reason to fail to render.
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(storedLocale);

  // `<html lang>` is not decoration: screen readers pick pronunciation from it,
  // and so does the browser's own spellchecker and translation prompt.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this session; it just will not outlive it.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      tCount: (key, count, params) => translatePlural(locale, key, count, params),
      intlLocale: INTL_LOCALES[locale],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);

  if (value === null) {
    // Louder than a silent fallback to the default locale: a component
    // rendering outside the provider would otherwise work in Ukrainian and
    // ignore the switcher, which is a bug that looks like a feature.
    throw new Error("useI18n must be used inside <I18nProvider>");
  }

  return value;
}
