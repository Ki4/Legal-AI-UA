#!/usr/bin/env node
// Static checks over apps/console/src/features/**/*.tsx and apps/console/src/app/**/*.tsx —
// the mechanical half of DoD §6 (docs/specs/console-feature-dod.md), "Design system and copy".
//
// The failure this prevents is invisible in review: a screen that reads correctly in the
// language and the theme the author tested in, and wrong in every other one, with nothing red
// until a reader switches. A hardcoded "Search title" compiles, renders, and looks finished in
// English; it is only wrong once somebody reads it in Ukrainian, which is not the reviewer's
// language and not the CI machine's job today. Same shape for a hand-written `bg-red-500`: it
// looks identical to `text-danger` until the theme flips, at which point one of them tracks the
// palette and the other does not. Both defects pass every existing gate — lint does not know
// which strings are copy, and typecheck does not know a colour from a class name — because
// nothing before this script has looked at what the JSX actually says.
//
// This reads the AST rather than grepping for quotes: a regex over the same files matches a
// decorative "—" between two elements, a punctuation-only separator, and a fixture string with
// equal enthusiasm, because it cannot tell a `JsxText` node from a `className` from a comment. A
// check that cries wolf that often gets disabled within a week. The AST answers "is this a
// string the reader sees" the way the compiler answers it — by syntax, not by a pattern that
// also matches a class name.
//
// The rule itself is `apps/console/CLAUDE.md`, "Copy: dictionary keys only" and "Tailwind:
// semantic tokens only". This file is what makes it something other than a thing to remember.
//
// `checkSource` is exported and `scripts/check-copy.test.mjs` runs every rule through it. The
// script was previously verified by watching each rule go red against a probe file by hand,
// which is evidence that expires the moment nobody repeats it — the same shape as the defects
// this checker was written to catch, one level up.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const consoleSrc = resolve(root, "apps/console/src");

// Excluded from the scan, and why — the next exclusion has to earn a line here too.
const EXCLUDED_FEATURES = {
  "design-kit": "the gallery documents design-system components for developers, not lawyers.",
};

// --- File discovery ----------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Every `.tsx` file the rules apply to, under the given `src` root. */
export function discoverFiles(srcRoot = consoleSrc) {
  const featuresDir = resolve(srcRoot, "features");
  const appDir = resolve(srcRoot, "app");

  const featureFiles = statSync(featuresDir, { throwIfNoEntry: false })?.isDirectory()
    ? readdirSync(featuresDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !(entry.name in EXCLUDED_FEATURES))
        .flatMap((entry) => walk(join(featuresDir, entry.name)))
    : [];

  const appFiles = statSync(appDir, { throwIfNoEntry: false })?.isDirectory() ? walk(appDir) : [];

  return [...featureFiles, ...appFiles];
}

// --- Suppression: `// check-copy-ignore: <reason>`, on the line above or on the line ----------
//
// A second, JSX-comment form is accepted for the same directive:
// `{/* check-copy-ignore: <reason> */}`. `//` is not a comment inside JSX children — the parser
// keeps it as literal `JsxText` (provably so: `<p>// foo</p>` renders the slashes) — so a `//`
// placed there would not suppress the finding below it, and would likely become a finding of its
// own. Every other check in this file lives in ordinary TS syntax (attributes, `{}` expressions),
// where `//` works exactly as specified. Without the JSX form, suppression would be unusable for
// check 1, the core one, so both forms are accepted rather than only the one named in the spec.

const IGNORE_RE_LINE = /\/\/\s*check-copy-ignore:\s*(.*)\s*$/;
const IGNORE_RE_JSX = /\{\s*\/\*\s*check-copy-ignore:\s*(.*?)\s*\*\/\s*\}/;

function collectSuppressions(text, relPath, problems) {
  const suppressed = new Set();
  let suppressionCount = 0;
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    const match = IGNORE_RE_LINE.exec(lineText) ?? IGNORE_RE_JSX.exec(lineText);
    if (match === null) return;
    const reason = match[1].trim();
    const lineNo = idx + 1;
    if (reason.length === 0) {
      problems.push(
        `${relPath}:${lineNo}: \`check-copy-ignore\` with no reason — state why this line is exempt, or remove the comment.`,
      );
      return;
    }
    suppressed.add(lineNo); // suppress a violation reported on the comment's own line
    suppressed.add(lineNo + 1); // ...or on the line right below it
    suppressionCount += 1;
  });
  return { suppressed, suppressionCount };
}

// --- Helpers shared across checks --------------------------------------------

function quote(text, max = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function report(relPath, sourceFile, node, message) {
  const line = lineOf(sourceFile, node);
  return { line, text: `${relPath}:${line}: ${message}` };
}

// JSX text that is only punctuation and/or entities (bullets, slashes, dashes, "&nbsp;") carries
// no words to translate. Presence of a Unicode letter is what makes it copy.
function isTranslatableText(rawText) {
  const withoutEntities = rawText.replace(/&[#a-zA-Z0-9]+;/g, "");
  return /\p{L}/u.test(withoutEntities);
}

const USER_VISIBLE_ATTRS = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-description",
  "label",
]);

// A ternary that decides English singular vs. plural by comparing to the literal 1.
function comparesToOne(expr) {
  if (!ts.isBinaryExpression(expr)) return false;
  const op = expr.operatorToken.kind;
  const isEqualityOp =
    op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    op === ts.SyntaxKind.EqualsEqualsToken ||
    op === ts.SyntaxKind.ExclamationEqualsToken;
  if (!isEqualityOp) return false;
  const isOne = (n) => ts.isNumericLiteral(n) && n.text === "1";
  return isOne(expr.left) || isOne(expr.right);
}

// Does a ternary branch carry raw copy? Looks for string-literal-like text or JSX text in the
// branch, but does not descend into call arguments — `t("catalogue.one")` is a dictionary
// lookup, not hardcoded copy, and its argument must not trip this check.
function branchHasLiteralText(node) {
  let found = false;
  function visit(n) {
    if (found) return;
    if (ts.isStringLiteralLike(n) && n.text.trim().length > 0) {
      found = true;
      return;
    }
    if (ts.isJsxText(n) && isTranslatableText(n.text)) {
      found = true;
      return;
    }
    if (ts.isTemplateExpression(n)) {
      const literalText = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join("");
      if (isTranslatableText(literalText)) {
        found = true;
        return;
      }
    }
    if (ts.isCallExpression(n)) return; // don't descend into t(...)/tCount(...) arguments
    ts.forEachChild(n, visit);
  }
  visit(node);
  return found;
}

const ERROR_NAME_RE = /error/i;
const T_LIKE_CALL_RE = /^t([A-Z]|$)/; // t, tCount, tSomething

// Does this `x.message` access reach somewhere a reader sees — inside JSX, or as an argument
// (at any depth) to a t-like call?
function reachesRender(node) {
  let current = node.parent;
  while (current !== undefined) {
    if (ts.isJsxExpression(current)) return true;
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      if (ts.isIdentifier(callee) && T_LIKE_CALL_RE.test(callee.text)) return true;
    }
    current = current.parent;
  }
  return false;
}

const LOCALE_METHODS = new Set([
  "toLocaleDateString",
  "toLocaleString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
  "toLocaleLowerCase",
]);

// --- Token discipline (className string content) -----------------------------
//
// Verified against every semantic token in apps/console/CLAUDE.md ("Tailwind: semantic tokens
// only") before trusting these patterns: bg-canvas, bg-paper, bg-paperAlt, border-line,
// border-lineStrong, text-ink, text-inkSoft, text-inkMute, bg-brand, text-brand, rounded-card,
// rounded-btn all pass, because none of them end in a Tailwind palette family followed by a
// shade number, and none of them are raw hex or a bare duration.

const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

const TAILWIND_PALETTE_FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_CLASS_RE = new RegExp(
  `\\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|accent|caret|decoration|shadow)-(?:${TAILWIND_PALETTE_FAMILIES})-\\d{2,3}\\b`,
  "g",
);

const RAW_DURATION_RE = /\bduration-\d+\b|\[\d+m?s\]/g;

// Call names that build a className string at runtime. None exist in this codebase today
// (checked: no `clsx`/`cn`/`classNames` import anywhere under apps/console/src or packages/ui),
// but the DoD rule is about the string content, not the site it appears at — so a call written
// tomorrow is covered without anyone having to remember to extend this list.
const CLASS_BUILDER_CALLS = new Set(["clsx", "cn", "classNames", "cva"]);

// `push` is the caller's file-scoped, suppression-aware sink — see the walk below.
function scanClassString(text, relPath, sourceFile, node, push) {
  const line = lineOf(sourceFile, node);
  const hexMatches = text.match(HEX_COLOR_RE) ?? [];
  for (const hex of hexMatches) {
    push({
      line,
      text: `${relPath}:${line}: className has hex colour "${hex}" — use a semantic token from packages/ui (apps/console/CLAUDE.md, "Tailwind: semantic tokens only").`,
    });
  }
  const paletteMatches = text.match(PALETTE_CLASS_RE) ?? [];
  for (const cls of paletteMatches) {
    push({
      line,
      text: `${relPath}:${line}: className has raw Tailwind palette class "${cls}" — use a semantic token (bg-paper/text-ink/... family) instead.`,
    });
  }
  const durationMatches = text.match(RAW_DURATION_RE) ?? [];
  for (const dur of durationMatches) {
    push({
      line,
      text: `${relPath}:${line}: className has raw duration "${dur}" — use a --motion-* token instead.`,
    });
  }
}

// Collects the literal text fragments out of a string-literal-like or template expression,
// ignoring interpolated parts (which could be anything, including a semantic token chosen at
// runtime).
function literalFragmentsOf(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
  }
  return [];
}

// --- The checks, over one file's source --------------------------------------

/**
 * Every rule, applied to one file's text.
 *
 * Takes the source rather than a path so the tests can hand it a probe without writing one to
 * disk, and so the counts below mean the same thing in a test as they do in a run.
 *
 * @returns {{ problems: string[], counts: Record<string, number> }}
 */
export function checkSource(relPath, text) {
  const problems = [];
  const { suppressed, suppressionCount } = collectSuppressions(text, relPath, problems);

  // Counted is every node *considered*, not just the ones that turn out to be a violation — a
  // success summary that only ever says "0" proves nothing was found, not that anything was
  // looked at.
  const counts = {
    jsxText: 0,
    attrs: 0,
    ternaries: 0,
    errorMessages: 0,
    intl: 0,
    classNames: 0,
    suppressions: suppressionCount,
  };

  const sourceFile = ts.createSourceFile(
    relPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function push(entry) {
    if (suppressed.has(entry.line)) return;
    problems.push(entry.text);
  }

  function visit(node) {
    // 1. JSX text -----------------------------------------------------------
    if (ts.isJsxText(node) && node.text.trim().length > 0) {
      counts.jsxText += 1;
      if (isTranslatableText(node.text)) {
        const { line, text: msg } = report(
          relPath,
          sourceFile,
          node,
          `JSX text "${quote(node.text)}" is a hardcoded string — move it to packages/i18n and render t("...") instead.`,
        );
        push({ line, text: msg });
      }
    }

    // 2. User-visible attributes ---------------------------------------------
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (USER_VISIBLE_ATTRS.has(attrName) && node.initializer !== undefined) {
        counts.attrs += 1;
        let literalText = null;
        if (ts.isStringLiteral(node.initializer)) {
          literalText = node.initializer.text;
        } else if (
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression !== undefined &&
          ts.isNoSubstitutionTemplateLiteral(node.initializer.expression)
        ) {
          literalText = node.initializer.expression.text;
        }
        if (literalText !== null && literalText.trim().length > 0) {
          const { line, text: msg } = report(
            relPath,
            sourceFile,
            node,
            `${attrName}="${quote(literalText)}" is a hardcoded string — use ${attrName}={t("...")} instead.`,
          );
          push({ line, text: msg });
        }
      }
    }

    // 3. Counted phrases decided by a ===1 ternary ---------------------------
    if (ts.isConditionalExpression(node) && comparesToOne(node.condition)) {
      counts.ternaries += 1;
      if (branchHasLiteralText(node.whenTrue) || branchHasLiteralText(node.whenFalse)) {
        const { line, text: msg } = report(
          relPath,
          sourceFile,
          node,
          `"${quote(node.condition.getText(sourceFile))} ? ... : ..." picks singular/plural by hand — use tCount("...", count) instead; Ukrainian has three plural forms, English's count === 1 is not one of them.`,
        );
        push({ line, text: msg });
      }
    }

    // 4. error.message reaching the render -----------------------------------
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "message" &&
      ts.isIdentifier(node.expression) &&
      ERROR_NAME_RE.test(node.expression.text)
    ) {
      counts.errorMessages += 1;
      if (reachesRender(node)) {
        const { line, text: msg } = report(
          relPath,
          sourceFile,
          node,
          `"${node.getText(sourceFile)}" reaches the render — map the error's code to a TranslationKey instead; .message is developer text and always English.`,
        );
        push({ line, text: msg });
      }
    }

    // 5. Intl without a locale -------------------------------------------------
    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Intl"
    ) {
      counts.intl += 1;
      if (node.arguments === undefined || node.arguments.length === 0) {
        const { line, text: msg } = report(
          relPath,
          sourceFile,
          node,
          `"new ${node.expression.getText(sourceFile)}()" has no locale — pass intlLocale from useI18n(); a formatter with a default locale is right by accident while there is one language.`,
        );
        push({ line, text: msg });
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      LOCALE_METHODS.has(node.expression.name.text)
    ) {
      counts.intl += 1;
      if (node.arguments.length === 0) {
        const { line, text: msg } = report(
          relPath,
          sourceFile,
          node,
          `".${node.expression.name.text}()" is called with no locale — pass intlLocale from useI18n() as the first argument.`,
        );
        push({ line, text: msg });
      }
    }

    // 6. Token discipline --------------------------------------------------
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === "className" &&
      node.initializer !== undefined
    ) {
      let fragments = [];
      if (ts.isStringLiteral(node.initializer)) {
        fragments = [node.initializer.text];
      } else if (
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression !== undefined
      ) {
        fragments = literalFragmentsOf(node.initializer.expression);
      }
      if (fragments.length > 0) {
        counts.classNames += 1;
        scanClassString(fragments.join(" "), relPath, sourceFile, node, push);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CLASS_BUILDER_CALLS.has(node.expression.text)
    ) {
      for (const arg of node.arguments) {
        const fragments = literalFragmentsOf(arg);
        if (fragments.length > 0) {
          counts.classNames += 1;
          scanClassString(fragments.join(" "), relPath, sourceFile, arg, push);
        }
        if (ts.isObjectLiteralExpression(arg)) {
          for (const prop of arg.properties) {
            if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
              const key = prop.name;
              const keyText = ts.isStringLiteral(key)
                ? key.text
                : ts.isIdentifier(key)
                  ? key.text
                  : null;
              if (keyText !== null) {
                counts.classNames += 1;
                scanClassString(keyText, relPath, sourceFile, prop, push);
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { problems, counts };
}

// --- CLI ----------------------------------------------------------------------

function main() {
  const files = discoverFiles();
  const problems = [];
  const totals = {
    jsxText: 0,
    attrs: 0,
    ternaries: 0,
    errorMessages: 0,
    intl: 0,
    classNames: 0,
    suppressions: 0,
  };

  for (const file of files) {
    const relPath = relative(root, file).split("\\").join("/");
    const result = checkSource(relPath, readFileSync(file, "utf8"));
    problems.push(...result.problems);
    for (const key of Object.keys(totals)) totals[key] += result.counts[key];
  }

  for (const problem of problems) console.error(`ERROR  ${problem}`);

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s) in apps/console copy or tokens.`);
    process.exit(1);
  }

  console.log(
    `copy: ${files.length} file(s) scanned — ` +
      `${totals.jsxText} JSX text node(s), ${totals.attrs} user-visible attribute(s), ` +
      `${totals.ternaries} count-vs-1 ternary(ies), ${totals.errorMessages} error.message access(es), ` +
      `${totals.intl} Intl/toLocale* call(s), ${totals.classNames} className string(s) checked, ` +
      `${totals.suppressions} suppression(s) in effect.`,
  );
}

// Run only when invoked as a script: importing this from a test must not walk the repository.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
