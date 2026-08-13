#!/usr/bin/env node
// Runs every supabase/snippets/verify_*.sql against a database and fails on any
// FAIL or ERROR line.
//
// This exists because of a contrast worth staring at. When `practice_area`
// became `not null`, the TypeScript fixture in packages/db broke the build the
// same minute. Four SQL fixtures had exactly the same disease and said nothing
// for a day — and the only difference between them was that something executes
// one and nothing executed the others. A check nobody runs is a comment.
//
// Usage:
//   pnpm verify:sql                  # against the local sandbox
//   DATABASE_URL=… pnpm verify:sql   # against a throwaway Postgres
//
// Never point this at a hosted project: the scripts create fixtures and end in
// rollback, which is a promise a dropped connection does not keep.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snippetsDir = resolve(root, "supabase/snippets");

// How to reach a database, in the order that works on the most machines.
//
// The container is preferred deliberately: `psql` is not installed on a Windows
// dev box and is on every CI runner, so reaching for the host client first would
// make this a check half the team cannot run — and a check people cannot run
// locally is one they meet for the first time when CI is already red.
function findRunner() {
  const url = process.env.DATABASE_URL;
  if (url !== undefined) {
    if (/supabase\.(co|in)/.test(url)) {
      console.error("ERROR  refusing to run verification fixtures against a hosted project.");
      process.exit(1);
    }
    return {
      kind: "psql",
      command: "psql",
      argsFor: () => [url, "-v", "ON_ERROR_STOP=0", "-f", "-"],
    };
  }

  const found = spawnSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  );
  const container = (found.stdout ?? "")
    .split(/\r?\n/)
    .map((name) => name.trim())
    .find((name) => name !== "");

  if (container !== undefined) {
    return {
      kind: `docker exec ${container}`,
      command: "docker",
      argsFor: () => [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=0",
      ],
    };
  }

  console.error(
    "ERROR  no local Supabase database found. Run `pnpm exec supabase start`, " +
      "or point DATABASE_URL at a throwaway Postgres.",
  );
  process.exit(1);
}

const runner = findRunner();

const files = readdirSync(snippetsDir)
  .filter((name) => name.startsWith("verify_") && name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("ERROR  no verify_*.sql found — this script would pass by doing nothing.");
  process.exit(1);
}

let failedFiles = 0;
let totalPassed = 0;

for (const file of files) {
  // The script goes in on stdin: it lives on the host, the client may live in a
  // container, and copying it in would be a third place for it to be stale.
  const sql = readFileSync(resolve(snippetsDir, file), "utf8");
  const result = spawnSync(runner.command, runner.argsFor(), { input: sql, encoding: "utf8" });

  // `raise notice` writes to stderr, so reading stdout alone finds a clean run
  // with nothing in it. That mistake got made while writing this file and was
  // caught only by the "no PASS lines" guard below, which is the whole argument
  // for having it.
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const lines = output.split(/\r?\n/);

  const passes = lines.filter((line) => /\bPASS\b/.test(line));
  const fails = lines.filter((line) => /\bFAIL\b/.test(line));
  const errors = lines.filter((line) => /\bERROR\b/.test(line));

  totalPassed += passes.length;
  let bad = fails.length > 0 || errors.length > 0;

  if (result.error !== undefined || passes.length === 0) {
    // A script that printed no PASS is not a script that proved something. It is
    // what a broken fixture leaves behind: the first block raises, everything
    // after it is skipped, and the run looks quiet rather than red.
    console.error(`ERROR  ${file}: no PASS lines at all — did the fixtures load?`);
    if (output.trim() !== "") console.error(output.trim());
    bad = true;
  }

  for (const line of [...fails, ...errors]) console.error(`  ${file}: ${line.trim()}`);
  if (bad) failedFiles += 1;

  console.log(
    `${file}: ${passes.length} passed, ${fails.length} failed, ${errors.length} error(s)`,
  );
}

if (failedFiles > 0) {
  console.error(`\n${failedFiles} verification script(s) did not come back clean.`);
  process.exit(1);
}

console.log(`\nsql verification: ${files.length} script(s), ${totalPassed} scenarios, all green.`);
