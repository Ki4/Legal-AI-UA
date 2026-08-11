#!/usr/bin/env node
// CLI for the documentation drift checks. The checks themselves live in
// check-docs-lib.mjs so the SessionStart hook can run them in-process.
//
// Run by `pnpm docs:check`, by the git pre-push hook, and in CI.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDocs } from "./check-docs-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { problems, notes, fileCount } = checkDocs(root);

for (const note of notes) console.log(`note   ${note}`);
for (const problem of problems) console.error(`ERROR  ${problem}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} documentation problem(s). Fix them or amend the docs.`);
  process.exit(1);
}

console.log(`docs: ${fileCount} files checked, ${notes.length} note(s), no problems.`);
