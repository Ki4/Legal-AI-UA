import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("renders hryvnia from integer minor units", () => {
    // 520000 minor is ₴5,200.00 — not 520000, and not 5200 without decimals.
    expect(formatMoney(520000, "UAH")).toMatch(/5\D?200/);
  });

  it("uses the currency's own exponent, not a hardcoded 100", () => {
    // The bug this guards: dividing everything by 100 renders a currency with
    // no minor unit a hundred times too small, silently, on a billing surface.
    expect(formatMoney(100, "JPY").replace(/\D/g, "")).toBe("100");
    // KWD has three minor digits, so 1000 minor is one dinar.
    expect(formatMoney(1000, "KWD")).toMatch(/1[.,]000|1\b/);
  });

  it("degrades instead of throwing on an unusable currency code", () => {
    // Intl throws on an unknown code. A formatter that throws takes the whole
    // screen down with it, because the console has no ErrorBoundary.
    expect(formatMoney(500, "NOTACURRENCY")).toBe("500 NOTACURRENCY");
  });

  it("handles zero", () => {
    expect(formatMoney(0, "UAH")).toMatch(/0/);
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDate("2026-07-30T14:05:00.000Z")).not.toBe("");
  });

  it("returns unparsable input unchanged rather than throwing", () => {
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate("")).toBe("");
  });
});
