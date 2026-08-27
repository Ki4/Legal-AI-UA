#!/usr/bin/env node
// Static checks over supabase/. No database — that is `verify:sql`.
//
// Both checks here exist because of the same failure, seen twice in one day on
// 2026-08-12: something new leaned on something old, and nothing noticed until a
// person happened to add a check nearby.
//
//   1. `repair_migration_ledger.sql` lists every migration by hand. It listed
//      seven while the repository shipped eight, so running it would have
//      declared the ledger complete while a migration was missing from it —
//      worse than an unrecorded migration, because `db push` then skips a file
//      whose contents the schema lacks.
//
//   2. A `do $$` block in a verification script inherits `role` and
//      `request.jwt.claims` from whichever block ran before it, because
//      `set local` lasts for the transaction. One scenario was passing only
//      because the previous scenario had left a conveniently-assigned lawyer in
//      the session. Detaching that lawyer turned a green check red while the
//      thing it tested was working perfectly.
//
// The rule these enforce is in supabase/CLAUDE.md. This file is what makes the
// rule something other than a thing to remember.
//
// The checks are a function of a directory rather than of this repository, and
// the CLI runs only when this file is invoked as one — so a test can hand it a
// tree that is deliberately wrong without walking `supabase/` or exiting the
// runner. That shape is the one every other checker here already had; this one
// got it on 2026-08-27, when it finally got tests.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkSql(root) {
  const migrationsDir = resolve(root, "supabase/migrations");
  const snippetsDir = resolve(root, "supabase/snippets");
  const problems = [];

  // 1. The ledger repair script lists exactly the migrations that exist ---------

  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => {
      const match = /^(\d{14})_(.+)\.sql$/.exec(name);
      if (match === null) {
        problems.push(`supabase/migrations/${name}: not <timestamp>_<name>.sql`);
        return null;
      }
      return { version: match[1], name: match[2], file: name };
    })
    .filter((entry) => entry !== null);

  const repairPath = resolve(snippetsDir, "repair_migration_ledger.sql");
  const repair = readFileSync(repairPath, "utf8");

  // Every ('20260101120000', 'name') pair in the insert.
  const listed = new Map(
    [...repair.matchAll(/\('(\d{14})',\s*'([^']+)'\)/g)].map((m) => [m[1], m[2]]),
  );

  for (const migration of migrations) {
    const found = listed.get(migration.version);
    if (found === undefined) {
      problems.push(
        `repair_migration_ledger.sql does not list ${migration.file}. ` +
          `A ledger repaired from this script would skip it, and \`db push\` would then skip the file.`,
      );
    } else if (found !== migration.name) {
      problems.push(
        `repair_migration_ledger.sql calls ${migration.version} "${found}", the file calls it "${migration.name}".`,
      );
    }
  }

  for (const [version] of listed) {
    if (!migrations.some((migration) => migration.version === version)) {
      problems.push(
        `repair_migration_ledger.sql lists ${version}, which no file in supabase/migrations/ matches. ` +
          `Recording a migration that was never applied is the worse half of this failure.`,
      );
    }
  }

  // 2. Every verification block says who it is acting as ------------------------
  //
  // Deliberately syntactic. Whether a scenario proves what it claims is not
  // decidable here and never will be; whether it declared its own identity is.

  const verifyFiles = readdirSync(snippetsDir).filter(
    (name) => name.startsWith("verify_") && name.endsWith(".sql"),
  );

  let blockCount = 0;

  for (const file of verifyFiles) {
    const sql = readFileSync(resolve(snippetsDir, file), "utf8");
    const blocks = [...sql.matchAll(/do \$\$([\s\S]*?)\$\$;/g)];

    if (blocks.length === 0) {
      problems.push(`supabase/snippets/${file}: no do $$ blocks — is this a verification script?`);
    }

    blocks.forEach((block, index) => {
      blockCount += 1;
      const body = block[1];
      const label = `supabase/snippets/${file}, block ${index + 1}`;

      const declaresRole = /set local role\s+\w+/.test(body);
      const declaresClaims = /set local request\.jwt\.claims/.test(body);

      if (!declaresRole && !declaresClaims) {
        problems.push(
          `${label}: acts as whoever the previous block left behind. ` +
            `\`set local\` lasts for the transaction, so a block that declares nothing inherits — ` +
            `state one of \`set local role\` or \`set local request.jwt.claims\` at the top.`,
        );
      }

      // The reset is what makes the check above worth having: it puts the session
      // back to no role and no claims, so the *next* block cannot silently borrow
      // an identity even if this one had a good reason to hold a strong role.
      const resetsRole = /reset role;/.test(body);
      const resetsClaims = /set_config\('request\.jwt\.claims',\s*''/.test(body);

      if (!resetsRole || !resetsClaims) {
        problems.push(
          `${label}: does not hand the session back. End it with \`reset role;\` and ` +
            `\`perform set_config('request.jwt.claims', '', true);\` — without both, the next block ` +
            `inherits this one, and a scenario that forgets to declare its identity passes for the ` +
            `wrong reason instead of failing loudly.`,
        );
      }
    });
  }

  return { problems, migrationCount: migrations.length, blockCount };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, migrationCount, blockCount } = checkSql(root);

  for (const problem of problems) console.error(`ERROR  ${problem}`);

  if (problems.length > 0) {
    console.error(`
${problems.length} problem(s) in supabase/.`);
    process.exit(1);
  }

  console.log(
    `sql: ${migrationCount} migration(s) listed for repair, ` +
      `${blockCount} verification block(s) declaring their own identity.`,
  );
}

// Runs its CLI only when invoked as one, so a test can call `checkSql` on a
// throwaway tree without walking this repository or exiting the runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
