// A checker that flags everything and one that flags nothing are equally
// useless, and only the pair of assertions tells them apart. So every rule below
// is given a token file that must trip it and the token file one value away that
// must not.
//
// The arithmetic is checked against published numbers rather than against
// itself: WCAG's own worked examples put black on white at 21:1 and any colour
// against itself at 1:1, so a sign error or a swapped luminance formula fails
// here rather than passing quietly with plausible-looking ratios.

import { describe, expect, it } from "vitest";
import {
  AA_NORMAL,
  PAIRS,
  audit,
  auditTheme,
  contrastRatio,
  parseHex,
  readTheme,
  relativeLuminance,
} from "./check-contrast.mjs";

function tokenFile({ light = {}, dark = {} } = {}) {
  const declare = (tokens) =>
    Object.entries(tokens)
      .map(([name, value]) => `  --ui-${name}: ${value};`)
      .join("\n");

  return `:root {\n  color-scheme: light;\n${declare(light)}\n}\n\n[data-theme="dark"] {\n  color-scheme: dark;\n${declare(dark)}\n}\n`;
}

const PASSING = {
  ink: "#000000",
  "ink-soft": "#000000",
  "ink-mute": "#000000",
  brand: "#000000",
  "on-brand": "#ffffff",
  "ok-ink": "#000000",
  "warn-ink": "#000000",
  "danger-ink": "#000000",
  paper: "#ffffff",
  "paper-alt": "#ffffff",
  canvas: "#ffffff",
};

describe("the arithmetic", () => {
  it("agrees with WCAG's own worked numbers at both ends", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the pair is given", () => {
    // The ratio is defined lighter-over-darker, so a caller passing the
    // background first must get the same answer. Getting this wrong produces
    // ratios below 1 that compare as failures for the wrong reason.
    expect(contrastRatio("#2563eb", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#2563eb"),
      10,
    );
  });

  it("reads three-digit hex as the six-digit colour it stands for", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#ffffff")).toEqual([255, 255, 255]);
  });

  it("applies the sRGB curve rather than averaging the channels", () => {
    // Mid-grey is the case that separates them: a flat average puts #808080 at
    // 0.5, and the real relative luminance is near 0.216. A checker built on the
    // average passes pairs that are genuinely unreadable.
    expect(relativeLuminance(parseHex("#808080"))).toBeCloseTo(0.2159, 3);
    expect(relativeLuminance(parseHex("#808080"))).not.toBeCloseTo(0.5, 1);
  });
});

describe("reading a theme out of the token file", () => {
  it("takes each block separately rather than letting the last one win", () => {
    // The two blocks define the same names. A flat scan of the file would return
    // the dark values for both themes — and would report the light theme as
    // green while never having measured it.
    const css = tokenFile({ light: { ink: "#111111" }, dark: { ink: "#eeeeee" } });

    expect(readTheme(css, ":root").ink).toBe("#111111");
    expect(readTheme(css, '[data-theme="dark"]').ink).toBe("#eeeeee");
  });

  it("says so when the block it was asked for is not there", () => {
    expect(() => readTheme(":root { --ui-ink: #000; }", '[data-theme="dark"]')).toThrow();
  });
});

describe("the rule, in both halves", () => {
  it("passes a pair that clears the floor and fails the pair one shade under it", () => {
    // #767676 on white is 4.54:1 — the classic just-passing grey. #777777 is
    // 4.48:1. One value apart, on opposite sides of the line.
    const passing = auditTheme({ ...PASSING, "ink-mute": "#767676" }, "light");
    const failing = auditTheme({ ...PASSING, "ink-mute": "#777777" }, "light");
    const of = (findings) => findings.find((f) => f.fg === "ink-mute" && f.bg === "paper")?.status;

    expect(of(passing)).toBe("pass");
    expect(of(failing)).toBe("fail");
  });

  it("holds the accent's foreground to the accent, not to the page", () => {
    // The defect this checker was written after: white reads perfectly against
    // the page and 2.5:1 against the light-blue fill it actually sits on.
    const findings = auditTheme({ ...PASSING, brand: "#60a5fa", "on-brand": "#ffffff" }, "dark");
    const onBrand = findings.find((f) => f.fg === "on-brand" && f.bg === "brand");

    expect(onBrand.status).toBe("fail");
    expect(onBrand.ratio).toBeCloseTo(2.54, 2);

    const fixed = auditTheme({ ...PASSING, brand: "#60a5fa", "on-brand": "#020617" }, "dark");
    expect(fixed.find((f) => f.fg === "on-brand" && f.bg === "brand").status).toBe("pass");
  });

  it("reports a pair naming a token the theme lacks, rather than skipping it", () => {
    // The failure mode that would make this whole file decorative: a renamed
    // token silently drops its pair, the count goes down, and everything left is
    // green.
    const withoutInkMute = { ...PASSING };
    delete withoutInkMute["ink-mute"];
    const findings = auditTheme(withoutInkMute, "light");

    expect(findings.filter((f) => f.status === "missing").length).toBeGreaterThan(0);
    expect(findings.length).toBe(PAIRS.length);
  });

  it("measures both themes, and fails on the one that is wrong", () => {
    const css = tokenFile({
      light: PASSING,
      dark: { ...PASSING, ink: "#fefefe", paper: "#ffffff" },
    });
    const findings = audit(css);

    expect(findings.filter((f) => f.theme === "light" && f.status === "fail")).toHaveLength(0);
    expect(findings.some((f) => f.theme === "dark" && f.status === "fail")).toBe(true);
  });
});

describe("the floor itself", () => {
  it("is AA for normal text, because nothing in this system is large by default", () => {
    // Guards a specific way of making a checker meaningless: relaxing 4.5 to
    // AA-large's 3.0 turns every failure above into a pass without anybody
    // touching a colour.
    expect(AA_NORMAL).toBe(4.5);
  });
});
