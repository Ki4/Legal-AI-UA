import { describe, expect, it } from "vitest";
import { en, enPlurals } from "./dictionaries/en";
import { uk, ukPlurals } from "./dictionaries/uk";
import { LOCALES } from "./locales";
import { translate, translatePlural } from "./translate";

describe("dictionaries", () => {
  it("cover the same keys in every locale", () => {
    // The compiler already enforces this. The test exists because the day
    // somebody loosens a type to unblock themselves, the compiler stops
    // enforcing it silently and this does not.
    expect(Object.keys(en).sort()).toEqual(Object.keys(uk).sort());
    expect(Object.keys(enPlurals).sort()).toEqual(Object.keys(ukPlurals).sort());
  });

  it("has no empty strings", () => {
    // An empty string type-checks perfectly and renders as a missing label.
    const blanks = Object.entries({ ...uk, ...en }).filter(([, value]) => value.trim() === "");

    expect(blanks).toEqual([]);
  });

  it("gives every plural entry the `other` form the platform falls back to", () => {
    for (const forms of [...Object.values(ukPlurals), ...Object.values(enPlurals)]) {
      expect(forms.other.trim()).not.toBe("");
    }
  });
});

describe("translate", () => {
  it("reads the requested locale", () => {
    expect(translate("uk", "nav.services")).toBe("Послуги");
    expect(translate("en", "nav.services")).toBe("Services");
  });

  it("fills placeholders", () => {
    // Uses a key that has none, so the behaviour under test is the pass-through
    // rather than a particular piece of copy.
    expect(translate("en", "nav.team", { unused: "x" })).toBe("Team");
  });

  it("leaves an unmatched placeholder standing rather than blanking it", () => {
    // `{name}` on screen is a bug somebody reports; a blank is a bug somebody
    // squints at and moves on from.
    expect(translate("uk", "app.name", {})).toBe("Legal-AI-UA");
  });
});

describe("translatePlural", () => {
  it("picks the Ukrainian form from the count, all three of them", () => {
    // The case an English-shaped `count === 1 ? a : b` gets wrong, and the
    // reason plurals are data rather than a ternary at the call site.
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 1)).toContain("1 послуга");
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 3)).toContain("3 послуги");
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 5)).toContain("5 послуг");
  });

  it("keeps counting correctly past twenty, where the forms come round again", () => {
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 21)).toContain("21 послуга");
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 22)).toContain("22 послуги");
    expect(translatePlural("uk", "catalogue.matchesElsewhere", 25)).toContain("25 послуг");
  });

  it("uses English's two forms without needing a third", () => {
    expect(translatePlural("en", "catalogue.matchesElsewhere", 1)).toContain("1 service matches");
    expect(translatePlural("en", "catalogue.matchesElsewhere", 4)).toContain("4 services match");
  });

  it("falls back to `other` for a form the locale's dictionary omits", () => {
    // English has no `few`; asking for a count that resolves to it must still
    // produce a sentence rather than undefined.
    for (const locale of LOCALES) {
      expect(translatePlural(locale, "catalogue.matchesElsewhere", 0)).not.toContain("undefined");
    }
  });
});
