import { LOCALES, LOCALE_LABELS, isLocale, useI18n } from "@legal-ai/i18n";
import { Select } from "@legal-ai/ui";

/**
 * Composition, not a missing primitive.
 *
 * `docs/specs/console-feature-dod.md` says a missing primitive is design-system
 * work rather than a local one-off — and this is not one: it is `Select` plus
 * the locale state, and the piece that would belong in `packages/ui` already
 * exists. Putting it there instead would make the design system import the
 * dictionary, so a component library would start knowing which languages the
 * product speaks.
 *
 * Rendered from `LOCALES.map` rather than a hand-written list, so adding a
 * language stays the one-line change ADR-0006 asked for. No flags: a language
 * is not a country, and for uk that mapping is politically loaded (spec §13).
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <Select
      aria-label={t("language.label")}
      value={locale}
      onChange={(event) => {
        const next = event.target.value;
        // The value came out of `LOCALES`, so this cannot fail — but a `<select>`
        // hands back a plain string, and narrowing it here is cheaper than an
        // assertion that stops being true when somebody edits the options.
        if (isLocale(next)) setLocale(next);
      }}
      options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
    />
  );
}
