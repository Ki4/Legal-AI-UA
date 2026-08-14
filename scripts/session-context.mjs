#!/usr/bin/env node
// Emitted into a fresh session's context by the SessionStart hook.
//
// The point is orientation, not a briefing: a handful of lines saying where the
// tree stands and whether the docs are self-consistent, so a session that never
// runs /session-start still is not working blind. Everything expensive — the
// roadmap, the journal, issue state — belongs to /session-start, which a person
// asks for.
//
// Never fails the session. A hook that breaks startup is worse than no hook, so
// every step degrades to silence.

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const lines = [];

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const dirty = git("status", "--porcelain");
if (branch) {
  lines.push(
    `Branch: ${branch}${dirty ? ` (${dirty.split("\n").length} uncommitted file(s))` : " (clean)"}`,
  );
}

const recent = git("log", "--oneline", "-3");
if (recent) lines.push(`Recent:\n${recent}`);

// The docs check, inline rather than shelled out to pnpm — a package-manager
// hop at session start is a second of latency for no benefit.
let docsSummary = "";
try {
  const { checkDocs } = await import("./check-docs-lib.mjs");
  const { problems, notes, fileCount } = checkDocs(ROOT);
  docsSummary =
    problems.length > 0
      ? `Docs: ${problems.length} problem(s) — run \`pnpm docs:check\`. These block every push.`
      : `Docs: ${fileCount} files consistent${notes.length > 0 ? `, ${notes.length} note(s)` : ""}.`;
} catch {
  docsSummary = "";
}
if (docsSummary) lines.push(docsSummary);

lines.push(
  "Orientation: docs/STATE.md is the one file to read on arrival — wave, in flight, blocking " +
    "questions, debts with their age. Everything else is read once a task is chosen: " +
    "docs/ROADMAP.md is the map, docs/specs/admin-console.md the console plan, " +
    "docs/specs/console-feature-dod.md what “done” means, docs/history/ and docs/journal/ how it " +
    "got here — those two on request only. Run /session-start for a full briefing.",
);

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: lines.join("\n"),
  },
  suppressOutput: true,
};

process.stdout.write(JSON.stringify(output));
