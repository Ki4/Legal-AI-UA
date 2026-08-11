#!/usr/bin/env node
// Mechanical drift checks for the documentation.
//
// These exist because of a specific failure: docs/ROADMAP.md claimed the
// one-off-versus-subscription question was still open long after it was
// answered, and nothing said so. A person noticed by accident. Everything
// checked here is decidable without judgement — a link that does not resolve,
// a cross-reference to a section that does not exist. Anything requiring an
// opinion about whether prose is still true stays a human's job; a check that
// fires for a defensible reason trains people to ignore checks.
//
// Run by `pnpm docs:check`, by the git pre-push hook, and in CI.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo", "supabase"]);

const problems = [];
const notes = [];

function fail(file, message) {
  problems.push(`${relative(ROOT, file)}: ${message}`);
}

function markdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, found);
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

const files = markdownFiles(ROOT);
const contents = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

// ---------------------------------------------------------------------------
// 1. Relative links resolve
// ---------------------------------------------------------------------------

for (const [file, text] of contents) {
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const path = resolve(dirname(file), target.split("#")[0]);
    try {
      statSync(path);
    } catch {
      fail(file, `link points at a file that does not exist: ${target}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Section cross-references resolve inside their own document
//
// A renumbered section is the usual way these rot: §9.4 keeps pointing at the
// number it had before something was inserted above it.
// ---------------------------------------------------------------------------

for (const [file, text] of contents) {
  // Both heading forms in use: `## 9. Law monitoring` carries a trailing dot,
  // `### 9.4 Article level` does not.
  const sections = new Set();
  for (const match of text.matchAll(/^#{2,6}\s+(\d+(?:\.\d+)*)[.\s]/gm)) sections.add(match[1]);
  if (sections.size === 0) continue;

  const referenced = new Set([...text.matchAll(/§(\d+(?:\.\d+)?)/g)].map((m) => m[1]));
  for (const ref of referenced) {
    if (!sections.has(ref)) fail(file, `cross-reference §${ref} has no such section`);
  }
}

// ---------------------------------------------------------------------------
// 3. Every backlog id mentioned is also defined by a table row
// ---------------------------------------------------------------------------

for (const [file, text] of contents) {
  const mentioned = new Set([...text.matchAll(/\bADM-(\d+)\b/g)].map((m) => m[1]));
  if (mentioned.size === 0) continue;

  const defined = new Set([...text.matchAll(/^\|\s*ADM-(\d+)\s*\|/gm)].map((m) => m[1]));
  if (defined.size === 0) continue; // a doc that only cites ids defined elsewhere

  for (const id of mentioned) {
    if (!defined.has(id)) fail(file, `ADM-${id} is referenced but has no row in any table`);
  }
}

// ---------------------------------------------------------------------------
// 4. No ADR is orphaned
//
// An architecture decision nobody links to is one nobody will find. This is
// the check that would have caught the stale roadmap: a decision landed and
// the map never mentioned it.
// ---------------------------------------------------------------------------

const adrDir = join(ROOT, "docs", "adr");
for (const entry of readdirSync(adrDir)) {
  const number = /^(\d{4})-/.exec(entry)?.[1];
  if (!number) continue;

  const needle = new RegExp(`ADR-${number}\\b`);
  const citedBy = [...contents]
    .filter(([file]) => !file.endsWith(entry))
    .filter(([, text]) => needle.test(text));

  if (citedBy.length === 0) {
    notes.push(`docs/adr/${entry}: nothing else in the docs mentions ADR-${number}`);
  }
}

// ---------------------------------------------------------------------------

for (const note of notes) console.log(`note   ${note}`);
for (const problem of problems) console.error(`ERROR  ${problem}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} documentation problem(s). Fix them or amend the docs.`);
  process.exit(1);
}

console.log(`docs: ${files.length} files checked, ${notes.length} note(s), no problems.`);
