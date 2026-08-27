#!/usr/bin/env node
// Every text colour the design system puts on every ground it puts it on,
// measured against WCAG AA — in both themes, without a browser.
//
// This is the fourth checker, after `docs:check`, `check:sql` and `check:copy`,
// and it exists because of a specific failure worth stating rather than
// summarising. `docs/STATE.md` carried a debt from 2026-08-14 reading "no screen
// has been seen in both themes; DoD §8's second half has no instrument". The
// day a screen was finally looked at, the first thing found was that the primary
// button had been rendering white on `--ui-brand` in the dark theme at **2.5:1**
// against a 4.5:1 floor — on every screen, since the theme was added. Meta text
// was failing at 2.8:1 in the light one.
//
// Neither could have been caught by the 472 tests that were green throughout,
// and not because anybody was careless: jsdom applies no stylesheet, so a
// component test can assert that a token was used and never that the result is
// readable. A screenshot cannot be asserted on either — somebody has to look,
// and looking is what had not happened for thirteen days.
//
// The contrast of two tokens, though, is arithmetic. It needs no DOM, no
// browser and no judgement, which makes it exactly the shape of thing a gate
// can hold. What a gate still cannot hold: whether the pair *below* describes
// how the components actually combine the tokens. That list is maintained by
// hand and is the honest weak point — a component inventing a new pairing is
// invisible here until somebody adds the line.
//
// Non-text is deliberately absent. Borders, dots, fills and icon glyphs are
// exempt from AA's text contrast rule, and holding them to 4.5:1 would produce
// failures that mean nothing and teach people to ignore the output.
//
//   node scripts/check-contrast.mjs

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS = resolve(root, "packages/ui/src/tokens.css");

/** AA for body text. Large text is allowed 3:1 and nothing here is large by default. */
export const AA_NORMAL = 4.5;

/**
 * What the system puts on what. Maintained by hand, and the reason each line
 * exists is the component that renders it — named, so a component that stops
 * rendering a pairing takes its line with it.
 */
export const PAIRS = [
  { fg: "ink", bg: "paper", why: "body text on a card" },
  { fg: "ink", bg: "canvas", why: "body text on the page ground" },
  { fg: "ink", bg: "paper-alt", why: "body text on a striped row" },
  { fg: "ink-soft", bg: "paper", why: "Label, table headers" },
  { fg: "ink-soft", bg: "canvas", why: "secondary text on the page ground" },
  { fg: "ink-soft", bg: "paper-alt", why: "secondary text on a striped row" },
  { fg: "ink-mute", bg: "paper", why: "meta lines, hints, field descriptions" },
  { fg: "ink-mute", bg: "canvas", why: "meta text on the page ground" },
  { fg: "ink-mute", bg: "paper-alt", why: "meta text on a striped row" },
  { fg: "brand", bg: "paper", why: "links, the mono key on a card" },
  { fg: "brand", bg: "canvas", why: "links on the page ground" },
  { fg: "on-brand", bg: "brand", why: "Button primary, the active nav item" },
  { fg: "ok-ink", bg: "paper", why: "status label text" },
  { fg: "warn-ink", bg: "paper", why: "status label text" },
  { fg: "danger-ink", bg: "paper", why: "status label text, Button danger" },
  { fg: "ok-ink", bg: "canvas", why: "status label text on the page ground" },
  { fg: "warn-ink", bg: "canvas", why: "status label text on the page ground" },
  { fg: "danger-ink", bg: "canvas", why: "status label text on the page ground" },
];

/**
 * Known failures, each with a reason and the date it was accepted.
 *
 * Empty, and meant to stay that way. It exists because the alternative to an
 * explicit list is an implicit one: a checker with no escape hatch gets switched
 * off the first time it is inconvenient, and then nothing is measured at all. A
 * line here is a decision somebody signed; a missing checker is nobody's.
 */
export const ACCEPTED = [];

export function parseHex(hex) {
  const value = hex.trim().replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

export function relativeLuminance([r, g, b]) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(parseHex(a)), relativeLuminance(parseHex(b))].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The `--ui-*` declarations of one theme.
 *
 * `:root` and `[data-theme="dark"]` are read as blocks rather than by scanning
 * the whole file, because both define the same names and a flat scan would hand
 * back whichever came last — which is to say, it would measure the dark theme
 * twice and call the light one green.
 */
export function readTheme(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`no ${selector} block in the token file`);

  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const block = css.slice(open, close);

  const tokens = {};
  for (const [, name, value] of block.matchAll(/--ui-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[name] = value;
  }
  return tokens;
}

export function auditTheme(tokens, themeName) {
  const findings = [];

  for (const pair of PAIRS) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];

    // A pair naming a token the theme does not define is a broken pair list,
    // not a passing check. Reported rather than skipped.
    if (fg === undefined || bg === undefined) {
      findings.push({
        ...pair,
        theme: themeName,
        ratio: null,
        status: "missing",
        detail: fg === undefined ? `--ui-${pair.fg}` : `--ui-${pair.bg}`,
      });
      continue;
    }

    const ratio = contrastRatio(fg, bg);
    const accepted = ACCEPTED.some(
      (entry) => entry.fg === pair.fg && entry.bg === pair.bg && entry.theme === themeName,
    );

    findings.push({
      ...pair,
      theme: themeName,
      ratio,
      status: ratio >= AA_NORMAL ? "pass" : accepted ? "accepted" : "fail",
    });
  }

  return findings;
}

export function audit(css) {
  return [
    ...auditTheme(readTheme(css, ":root"), "light"),
    ...auditTheme(readTheme(css, '[data-theme="dark"]'), "dark"),
  ];
}

function main() {
  const findings = audit(readFileSync(TOKENS, "utf8"));
  const failed = findings.filter((f) => f.status === "fail" || f.status === "missing");
  const accepted = findings.filter((f) => f.status === "accepted");

  for (const finding of failed) {
    if (finding.status === "missing") {
      console.error(
        `ERROR  ${finding.theme}: the pair ${finding.fg} on ${finding.bg} names ${finding.detail}, which the theme does not define.`,
      );
      continue;
    }
    console.error(
      `ERROR  ${finding.theme}: ${finding.fg} on ${finding.bg} is ${finding.ratio.toFixed(2)}:1, ` +
        `below AA's ${AA_NORMAL}:1 — ${finding.why}.`,
    );
  }

  for (const finding of accepted) {
    console.warn(
      `note   ${finding.theme}: ${finding.fg} on ${finding.bg} is ${finding.ratio.toFixed(2)}:1, accepted.`,
    );
  }

  const worst = findings
    .filter((f) => f.ratio !== null)
    .reduce((low, f) => (f.ratio < low.ratio ? f : low));

  console.log(
    `contrast: ${findings.length} pair(s) over 2 themes, ${accepted.length} accepted, ` +
      `tightest passing margin ${worst.ratio.toFixed(2)}:1 (${worst.fg} on ${worst.bg}, ${worst.theme}).`,
  );

  if (failed.length > 0) {
    console.error(
      `\n${failed.length} contrast problem(s). Fix the token, or accept it in writing.`,
    );
    process.exit(1);
  }
}

// Runs its CLI only when invoked as one, so a test can call the functions above
// without walking the repository or exiting the runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
