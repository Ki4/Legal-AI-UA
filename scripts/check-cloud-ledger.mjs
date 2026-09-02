#!/usr/bin/env node
// Asks the cloud whether it agrees with supabase/migrations/.
//
// `check-sql.mjs` compares the migration files against the hand-written ledger
// repair script — two things in this repository. Nothing compared either of
// them against the database they describe, and on 2026-08-28 the cloud was
// found five migrations behind with no record of when it fell behind. It was
// repaired by hand. This is the part that would have noticed.
//
// It found the same drift again the day it was written, 2026-09-02: the two
// tables ADM-42's fetcher writes to did not exist in the cloud, while the
// feature that writes to them was already merged to `main`. That is the whole
// argument for this being a gate rather than a habit.
//
// Three ways this check can be wrong, and what each costs:
//
//   1. A migration in the repository the cloud has not applied. The 2026-08-28
//      case. `db push` fixes it, and the message says so.
//   2. A migration the cloud has that no file matches. Worse, and `db push`
//      is exactly the wrong response: somebody changed the schema by hand and
//      the change exists nowhere anybody can reproduce.
//   3. The check not running. A gate that skips itself when a credential is
//      absent is the defect it was written to catch, one level up — so every
//      failure to reach the cloud is a non-zero exit, never a pass with a note.
//
// Requires a Supabase access token and a linked project. In CI that means
// SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD as secrets; absent them this
// exits 1 and says which one it wanted.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * The rule. Takes the rows `supabase migration list --linked` reports and says
 * where the repository and the cloud disagree.
 */
export function compareLedger(rows) {
  const problems = [];
  let agreedCount = 0;

  if (rows.length === 0) {
    problems.push(
      "The ledger reports no migrations at all — neither local nor remote. " +
        "That is not agreement: it is the shape a wrong --workdir or an unlinked project makes, " +
        "and it is the shape that reads as green.",
    );
    return { problems, agreedCount, pending: [], untracked: [] };
  }

  const pending = [];
  const untracked = [];

  for (const row of rows) {
    const local = (row.local ?? "").trim();
    const remote = (row.remote ?? "").trim();

    if (local !== "" && remote !== "") {
      agreedCount += 1;
    } else if (local !== "") {
      pending.push(local);
      problems.push(
        `${local} is in supabase/migrations/ but not applied to the linked project. ` +
          "The repository describes a schema the cloud does not have; `supabase db push` is what closes it.",
      );
    } else if (remote !== "") {
      untracked.push(remote);
      problems.push(
        `${remote} is applied to the linked project but no file in supabase/migrations/ matches it. ` +
          "Somebody changed the schema by hand, and that change exists nowhere it can be reproduced from. " +
          "Do not `db push` past this and do not `migration repair` it away — recover the SQL first.",
      );
    }
  }

  return { problems, agreedCount, pending, untracked };
}

/**
 * The plumbing, separated so its two quiet failures can be asserted.
 *
 * `supabase` detects an agent on stdout and switches to JSON by itself, so the
 * same command prints a table for a person and JSON for a tool. The CLI below
 * pins `--output-format json`; this refuses anything else rather than parsing
 * zero rows out of a table and calling the ledger clean.
 */
export function parseLedgerOutput(output, exitCode) {
  if (exitCode !== 0) {
    throw new Error(
      `\`supabase migration list --linked\` exited ${exitCode}. Its output was:\n${output.trim()}\n\n` +
        "This is a failure, not a skip. If it is asking for credentials, the run needs " +
        "SUPABASE_ACCESS_TOKEN and a linked project (SUPABASE_DB_PASSWORD in CI).",
    );
  }

  const start = output.indexOf("{");
  if (start === -1) {
    throw new Error(
      "`supabase migration list --linked` printed something that is not JSON, though " +
        "--output-format json was asked for. Output was:\n" +
        output.trim(),
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(output.slice(start));
  } catch {
    throw new Error(
      "`supabase migration list --linked` printed something that is not JSON, though " +
        "--output-format json was asked for. Output was:\n" +
        output.trim(),
    );
  }

  if (!Array.isArray(parsed.migrations)) {
    throw new Error(
      "`supabase migration list --linked` returned JSON with no `migrations` array. Output was:\n" +
        output.trim(),
    );
  }

  return parsed.migrations;
}

function readLedger() {
  let output;
  let exitCode = 0;

  try {
    // Through `pnpm exec`: `supabase` is a devDependency of this repository, not
    // something on PATH. Calling it bare exits 1 with "not recognized", which is
    // at least loud — but it is the wrong failure and it reads like a missing
    // credential.
    output = execFileSync(
      "pnpm",
      [
        "exec",
        "supabase",
        "migration",
        "list",
        "--linked",
        "--output-format",
        "json",
        "--agent",
        "no",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true },
    );
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    exitCode = error.status ?? 1;
  }

  return parseLedgerOutput(output, exitCode);
}

function main() {
  let rows;
  try {
    rows = readLedger();
  } catch (error) {
    console.error(`ERROR  ${error.message}`);
    process.exit(1);
  }

  const { problems, agreedCount, pending, untracked } = compareLedger(rows);

  for (const problem of problems) console.error(`ERROR  ${problem}`);

  if (problems.length > 0) {
    console.error(
      `\n${problems.length} disagreement(s) between supabase/migrations/ and the linked project ` +
        `(${pending.length} unapplied, ${untracked.length} applied by hand).`,
    );
    process.exit(1);
  }

  console.log(`cloud ledger: ${agreedCount} migration(s), repository and linked project agree.`);
}

// Runs its CLI only when invoked as one, so a test can call the core without
// reaching the network or exiting the runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
