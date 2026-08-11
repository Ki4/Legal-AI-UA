// Mechanical drift checks for the documentation, as a function so both the
// `pnpm docs:check` CLI and the SessionStart hook can use it without one
// shelling out to the other.
//
// These exist because of a specific failure: docs/ROADMAP.md claimed the
// one-off-versus-subscription question was still open long after it was
// answered, and nothing said so. A person noticed by accident. Everything
// checked here is decidable without judgement — a link that does not resolve, a
// cross-reference to a section that does not exist. Whether prose is still
// *true* stays a reader's job; a check that fires for a defensible reason
// teaches people to ignore checks.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo", "supabase"]);

function markdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, found);
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

export function checkDocs(root) {
  const problems = [];
  const notes = [];
  const fail = (file, message) => problems.push(`${relative(root, file)}: ${message}`);

  const files = markdownFiles(root);
  const contents = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

  // 1. Relative links resolve.
  for (const [file, text] of contents) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      try {
        statSync(resolve(dirname(file), target.split("#")[0]));
      } catch {
        fail(file, `link points at a file that does not exist: ${target}`);
      }
    }
  }

  // 2. Section cross-references resolve inside their own document. Renumbering
  //    is the usual way these rot: §9.4 keeps pointing at the number it had
  //    before something was inserted above it.
  //
  //    Both heading forms are in use: `## 9. Law monitoring` carries a trailing
  //    dot, `### 9.4 Article level` does not.
  //
  //    Limit worth knowing: a document that does not number its sections is
  //    skipped entirely, so a stray §-reference in ROADMAP goes unnoticed.
  for (const [file, text] of contents) {
    const sections = new Set();
    for (const match of text.matchAll(/^#{2,6}\s+(\d+(?:\.\d+)*)[.\s]/gm)) sections.add(match[1]);
    if (sections.size === 0) continue;

    for (const match of text.matchAll(/§(\d+(?:\.\d+)?)/g)) {
      if (!sections.has(match[1])) fail(file, `cross-reference §${match[1]} has no such section`);
    }
  }

  // 3. Every backlog id mentioned is also defined by a table row.
  for (const [file, text] of contents) {
    const mentioned = new Set([...text.matchAll(/\bADM-(\d+)\b/g)].map((m) => m[1]));
    if (mentioned.size === 0) continue;

    const defined = new Set([...text.matchAll(/^\|\s*ADM-(\d+)\s*\|/gm)].map((m) => m[1]));
    if (defined.size === 0) continue; // a doc that only cites ids defined elsewhere

    for (const id of mentioned) {
      if (!defined.has(id)) fail(file, `ADM-${id} is referenced but has no row in any table`);
    }
  }

  // 4. No ADR is orphaned. A decision nobody links to is one nobody will find.
  //    A note rather than a failure: several predate the habit.
  const adrDir = join(root, "docs", "adr");
  for (const entry of readdirSync(adrDir)) {
    const number = /^(\d{4})-/.exec(entry)?.[1];
    if (!number) continue;

    const needle = new RegExp(`ADR-${number}\\b`);
    const cited = [...contents].some(([file, text]) => !file.endsWith(entry) && needle.test(text));
    if (!cited) notes.push(`docs/adr/${entry}: nothing else in the docs mentions ADR-${number}`);
  }

  return { problems, notes, fileCount: files.length };
}
