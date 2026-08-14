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
// silent too.
//
// `shell: true` is the one-line answer to that and it is not safe here. Node
// then builds a single command string out of the command and its arguments,
// and the arguments are staged file *paths* — data this script does not
// choose. `x & calc.py` is a legal Windows filename and is two commands to
// `cmd.exe`. A git hook is precisely where a filename somebody else picked
// arrives: a branch is fetched, its files are staged, and the hook runs before
// anybody has read them. So the command line is built below with every token
// quoted, rather than handed to a shell as a string.
//
// Quoting neutralises `&`, `|`, `^`, `<`, `>`, `(`, `)` and spaces. It does not
// neutralise `%`, which `cmd.exe` expands inside quotes too and for which a
// `/c` string has no dependable escape — so a path containing `%` or `"` is
// refused with a message rather than run on a guess. Neither is a shape a
// Python module in this repository would have.
//
// The four functions below are exported and `scripts/py-lane.test.mjs` covers
// them, including a test that hands the built command line to a real `cmd.exe`
// on Windows and checks the injected half does not run. That demonstration was
// done by hand when the injection was found; a test is what keeps it done.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * The first path in `where`/`which` output, or null when it found nothing.
 *
 * `where` can list several matches, one per line, when more than one ruff is
 * on PATH; the first is the one an ordinary invocation of `ruff` would run, so
 * it is the one this script must run too.
 */
export function firstResolvedPath(stdout) {
  const [first] = (stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  return first ?? null;
}

/** True when the resolved path can only be run through `cmd.exe` — see the header. */
export function needsCmdWrapper(platform, ruffPath) {
  return platform === "win32" && /\.(cmd|bat)$/i.test(ruffPath);
}

/** Characters a quoted `cmd.exe` token still does not make inert — see the header. */
const UNQUOTABLE_FOR_CMD = /["%]/;

/** The arguments that cannot be made safe by quoting, so the run is refused instead. */
export function unsafeCmdArgs(args) {
  return args.filter((arg) => UNQUOTABLE_FOR_CMD.test(arg));
}

/**
 * The `cmd /c` command line, with every token quoted here rather than by a
 * shell that would parse the paths first.
 *
 * `/s` makes cmd.exe strip the outermost pair of quotes and take the rest
 * verbatim, which is why the whole line is wrapped in one more pair — the same
 * shape Node's own `shell: true` builds.
 */
export function buildCmdLine(ruffPath, args) {
  return `"${[ruffPath, ...args].map((token) => `"${token}"`).join(" ")}"`;
}

function resolveRuff() {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", ["ruff"], { encoding: "utf8" })
      : spawnSync("which", ["ruff"], { encoding: "utf8" });

  if (probe.error !== undefined || probe.status !== 0) return null;

  return firstResolvedPath(probe.stdout);
}

function main(files) {
  if (files.length === 0) {
    process.exit(0);
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

  const needsCmd = needsCmdWrapper(process.platform, ruff);

  function spawnRuff(args) {
    if (!needsCmd) {
      return spawnSync(ruff, args, { stdio: "inherit" });
    }

    const unsafe = unsafeCmdArgs(args);
    if (unsafe.length > 0) {
      console.error(
        `py-lane: refusing to run ruff through cmd.exe on a path containing \`"\` or \`%\`: ` +
          `${unsafe.join(", ")}\n` +
          "Those survive quoting in a cmd /c command line, so running them would mean guessing at " +
          "what the shell does with a filename this script did not choose. Rename the file, or " +
          "install ruff as a native executable so no shell is involved.",
      );
      process.exit(1);
    }

    return spawnSync("cmd.exe", ["/d", "/s", "/c", buildCmdLine(ruff, args)], {
      stdio: "inherit",
      windowsVerbatimArguments: true,
    });
  }

  function runRuff(args) {
    const result = spawnRuff(args);
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
}

// Run only when invoked as a script: importing this from a test must not spawn
// anything or exit the runner.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
