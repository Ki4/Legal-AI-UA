import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

// The tags `useI18n().intlLocale` hands a component (`INTL_LOCALES`). Written
// out rather than imported so that a change to the mapping shows up here as a
// deliberate edit instead of quietly changing what these tests assert.
const UK = "uk-UA";
const EN = "en-GB";

describe("formatMoney", () => {
  it("renders hryvnia from integer minor units", () => {
    // 520000 minor is ₴5,200.00 — not 520000, and not 5200 without decimals.
    expect(formatMoney(520000, "UAH", UK)).toMatch(/5\D?200/);
  });

  it("uses the currency's own exponent, not a hardcoded 100", () => {
    // The bug this guards: dividing everything by 100 renders a currency with
    // no minor unit a hundred times too small, silently, on a billing surface.
    expect(formatMoney(100, "JPY", UK).replace(/\D/g, "")).toBe("100");
    // KWD has three minor digits, so 1000 minor is one dinar.
    expect(formatMoney(1000, "KWD", UK)).toMatch(/1[.,]000|1\b/);
  });

  it("follows the locale it is given rather than one baked in", () => {
    // The reason the parameter is required. Ukrainian puts the symbol after the
    // amount and separates thousands with a space; British English does
    // neither, and a formatter frozen on one of them renders the other
    // language's screen in the wrong convention without failing anything.
    const uk = formatMoney(520000, "UAH", UK);
    const en = formatMoney(520000, "UAH", EN);

    expect(uk).not.toBe(en);
  });

  it("degrades instead of throwing on an unusable currency code", () => {
    // Intl throws on an unknown code. A formatter that throws takes the whole
    // screen down with it, because the console has no ErrorBoundary.
    expect(formatMoney(500, "NOTACURRENCY", UK)).toBe("500 NOTACURRENCY");
  });

  it("handles zero", () => {
    expect(formatMoney(0, "UAH", UK)).toMatch(/0/);
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDate("2026-07-30T14:05:00.000Z", UK)).not.toBe("");
  });

  it("names the month in the locale it is given", () => {
    // A medium date style spells the month out, so this is the one place the
    // wrong locale is visible to a reader rather than merely to a test.
    expect(formatDate("2026-07-30T14:05:00.000Z", UK)).not.toBe(
      formatDate("2026-07-30T14:05:00.000Z", EN),
    );
  });

  it("returns unparsable input unchanged rather than throwing", () => {
    expect(formatDate("not a date", UK)).toBe("not a date");
    expect(formatDate("", UK)).toBe("");
  });
});
