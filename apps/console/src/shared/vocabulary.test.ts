// What the compiler cannot check about the enum → key maps.
//
// It already enforces that every enum value has a key and that every key
// exists. What it cannot see is two values pointing at the *same* key — the
// copy-paste that makes `paused` read "Archived" on screen, which type-checks
// perfectly and is only ever caught by somebody noticing that a paused service
// says the wrong word.

import { LOCALES, translate } from "@legal-ai/i18n";
import { describe, expect, it } from "vitest";
import { generationModeKey, reviewModeKey, serviceStatusKey } from "./vocabulary";

const MAPS = {
  serviceStatus: serviceStatusKey,
  generationMode: generationModeKey,
  reviewMode: reviewModeKey,
};

describe("domain vocabulary", () => {
  it("gives every value its own key", () => {
    for (const [name, map] of Object.entries(MAPS)) {
      const keys = Object.values(map);
      expect(new Set(keys).size, `${name} reuses a key`).toBe(keys.length);
    }
  });

  it("resolves in every locale, through `translate` rather than by lookup", () => {
    // Invoked, not merely defined (DoD §8): a key present in the dictionary but
    // unreachable through the translator would pass an object comparison and
    // still render nothing.
    for (const map of Object.values(MAPS)) {
      for (const key of Object.values(map)) {
        for (const locale of LOCALES) {
          const rendered = translate(locale, key);

          expect(rendered.trim()).not.toBe("");
          // The fallback in `translate` returns the key itself when a
          // dictionary has no entry. That is the failure this asserts against.
          expect(rendered).not.toBe(key);
        }
      }
    }
  });

  it("says something different in the two languages", () => {
    // Not cosmetic: a dictionary entry copied across locales is how a screen
    // ends up English in Ukrainian, and every check above passes on it.
    const uk = Object.values(serviceStatusKey).map((key) => translate("uk", key));
    const en = Object.values(serviceStatusKey).map((key) => translate("en", key));

    expect(uk).not.toEqual(en);
  });
});
