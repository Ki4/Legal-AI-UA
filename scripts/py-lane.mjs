#!/usr/bin/env node
// `package.json`'s `lint-staged["*.py"]` entry calls this on every staged
// Python file. It used to call `ruff format` and `ruff check --fix` directly,
// and `ruff` is installed nowhere in this environment: ADR-0016 made
// `apps/core` Python and gave it its own lint, format and test lane, but
// `apps/core` does not exist yet, so nothing has ever installed the tool that
// lane needs. The result was the first staged `.py` file dying on
// `sh: ruff: command not found` — a message that says nothing about why or
// what to do about it, waiting for whoever stages a `.py` file first.
//
// This file is the missing "why" and "what to do": it resolves `ruff` on
// PATH before calling it, and turns the same failure into a message that
// names ADR-0016, names the lane that does not exist yet, and says how to fix
// it. Either way the hook still blocks the commit when something is wrong —
// a resolvable `ruff` runs for real and its exit code is not swallowed,
// because a lint-staged entry that always exits 0 is not a gate, it is a
// formality.
//
// The probe resolves an actual path and that exact path is what gets spawned
// — it does not just check a boolean and then spawn the bare command name
// again. On Windows, `where ruff` happily finds `ruff.CMD` (e.g. an npm
// devDependency's `node_modules/.bin` shim on lint-staged's PATH), but
// `spawnSync("ruff", …)` without a shell only resolves `.exe`. A probe and an
// invocation that look up the name separately can find different things — or
// one can find something and the other find nothing — which is the same
// silent failure this file exists to prevent, one line lower.
//
// A resolved `.cmd`/`.bat` path is not directly executable by `CreateProcess`
// either: Windows needs `cmd.exe` to run one, so `spawnSync` of the bare path
// throws `EINVAL` rather than running it — under `stdio: "inherit"` that is
// silent too. `shell: true` is scoped to exactly that case below, and nowhere
// else: it is a platform requirement for `.cmd`/`.bat`, not a stylistic
// choice, so an ordinary `.exe` — what a Python-toolchain `ruff` install
// (ADR-0016) actually produces — never has a staged file's own path run
// through a shell parser for no reason.

import { spawnSync } from "node:child_process";

const files = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

/** The first line of `where`/`which`'s output, or null if it found nothing. */
function resolveRuff() {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", ["ruff"], { encoding: "utf8" })
      : spawnSync("which", ["ruff"], { encoding: "utf8" });

  if (probe.error !== undefined || probe.status !== 0) return null;

  // `where` can list several matches, one per line, when more than one ruff
  // is on PATH; the first is the one an ordinary invocation of `ruff` would
  // run, so it is the one this script must run too.
  const [first] = (probe.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  return first ?? null;
}

const ruff = resolveRuff();

if (ruff === null) {
  console.error(
    `py-lane: \`ruff\` is not on PATH — ${files.length} staged Python file(s) were not formatted ` +
      "or linted.\n\n" +
      "ADR-0016 (docs/adr/0016-core-in-python.md) made apps/core Python, and root CLAUDE.md records " +
      "that apps/core carries its own lint, format and test lane rather than the root pnpm scripts " +
      "— ruff is that lane's formatter and linter. apps/core does not exist yet, which is why ruff " +
      "was never installed: this is the first Python file staged in the repository, not a broken " +
      "setup.\n\n" +
      "Install ruff (https://docs.astral.sh/ruff/installation/, e.g. `pipx install ruff` or " +
      "`pip install ruff`) so it resolves on PATH, then stage the file again.",
  );
  process.exit(1);
}

const needsShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(ruff);

function runRuff(args) {
  const result = spawnSync(ruff, args, { stdio: "inherit", shell: needsShell });
  if (result.error !== undefined) {
    // spawnSync failing to launch the process at all — a stale resolution, a
    // permissions problem — is exactly the silent case this file exists to
    // rule out, so it gets a line even though `stdio: "inherit"` did not.
    console.error(`py-lane: failed to run ${ruff}: ${result.error.message}`);
  }
  return result;
}

const format = runRuff(["format", ...files]);
if (format.status !== 0) {
  // A process killed by a signal reports a null status, not a zero one —
  // treating that as success would let a crashed `ruff` pass the hook.
  process.exit(format.status ?? 1);
}

const check = runRuff(["check", "--fix", ...files]);
process.exit(check.status ?? 1);
