#!/usr/bin/env node
// Runs every probe in `probes.mjs`: break one thing, watch the named test go
// red, put it back.
//
//   pnpm probes            # all of them
//   pnpm probes checkbox   # only probes whose id contains "checkbox"
//
// Three safety properties, in the order they matter:
//
//   1. **It refuses to start on a dirty working tree.** This script edits real
//      source files. If it dies between the write and the restore — a killed
//      terminal, a machine asleep — `git checkout` is the recovery, and that is
//      only a recovery if there was nothing else uncommitted to lose.
//   2. **Every patch is restored in a `finally`,** from the exact bytes read
//      before it, not by re-applying the reverse patch. A reverse patch can fail
//      halfway; a rewrite of the original cannot.
//   3. **A probe whose `from` text is gone is a failure, not a skip.** That is
//      the whole failure mode this file exists to prevent, one level up: the
//      code moved, the probe silently stopped probing, and the run stayed green.
//
// Two things can watch. Most probes name a test file and are watched by Vitest;
// a probe that names a package in `typecheck` instead is watched by that
// package's `tsc`, because an assertion written as a type is invisible to a test
// run. Which one a probe uses is a property of the assertion, not a preference.
//
// What it does not do is prove a test is *good*. A probe says one assertion
// notices one change. A test that notices the change and asserts nothing else
// useful still passes here.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROBES } from "./probes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function workingTreeIsClean() {
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0) return null;
  return status.stdout.trim() === "";
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

/** Vitest's exit code, with output swallowed — a probe expects red, and red is not news. */
function runTest(testPath) {
  const result = spawnSync(pnpm, ["exec", "vitest", "run", testPath, "--reporter=dot"], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status;
}

/**
 * `tsc`'s exit code for one package.
 *
 * Vitest transpiles types away without checking them, so an assertion written as
 * a type — the `…AreExhaustive` bridges in `packages/core-client` — is inert
 * under `runTest` above: break it and the test run stays green, which would make
 * the probe report a defect that is not there. Those probes name a package
 * instead of a test file, and this is what watches them.
 */
function runTypecheck(pkg) {
  const result = spawnSync(pnpm, ["--filter", pkg, "typecheck"], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status;
}

/** What must go red, and how to ask it. */
function watcherOf(probe) {
  return probe.typecheck === undefined
    ? { run: () => runTest(probe.test), name: probe.test }
    : {
        run: () => runTypecheck(probe.typecheck),
        name: `${probe.test} (\`tsc\`, ${probe.typecheck})`,
      };
}

function main() {
  const filter = process.argv[2];
  const probes = filter === undefined ? PROBES : PROBES.filter((p) => p.id.includes(filter));

  if (probes.length === 0) {
    console.error(`No probe matches "${filter}".`);
    process.exit(1);
  }

  const clean = workingTreeIsClean();
  if (clean === null) {
    console.error("ERROR  not a git repository, or git is unavailable. Refusing to edit sources.");
    process.exit(1);
  }
  if (!clean) {
    console.error(
      "ERROR  the working tree has uncommitted changes.\n" +
        "       This script edits real files and restores them afterwards. If it is interrupted,\n" +
        "       `git checkout .` is the recovery — which is only safe when there is nothing else\n" +
        "       uncommitted. Commit or stash first.",
    );
    process.exit(1);
  }

  const failures = [];

  for (const probe of probes) {
    const file = resolve(root, probe.file);
    const original = readFileSync(file, "utf8");

    if (!original.includes(probe.from)) {
      // The probe rotted. Reported loudly rather than skipped, because a skipped
      // probe and a passing one look identical in a summary line.
      failures.push(
        `${probe.id}: the code it patches is gone from ${probe.file}. ` +
          `Either the behaviour moved and the probe should follow it, or it was removed and the ` +
          `probe should be too — but nothing is being probed right now.`,
      );
      console.error(`ROTTED  ${probe.id}`);
      continue;
    }

    const occurrences = original.split(probe.from).length - 1;
    if (occurrences > 1) {
      failures.push(
        `${probe.id}: patches ${occurrences} places in ${probe.file}. A probe must name one.`,
      );
      console.error(`AMBIGUOUS  ${probe.id}`);
      continue;
    }

    const watcher = watcherOf(probe);

    let status;
    try {
      writeFileSync(file, original.replace(probe.from, probe.to), "utf8");
      status = watcher.run();
    } finally {
      writeFileSync(file, original, "utf8");
    }

    if (status === 0) {
      failures.push(
        `${probe.id}: ${watcher.name} passed while the code ${probe.what}. ` +
          `The assertion that was supposed to notice is not reaching it.`,
      );
      console.error(`CAUGHT NOTHING  ${probe.id} — ${probe.what}`);
    } else {
      console.log(`caught  ${probe.id} — ${probe.what}`);
    }
  }

  console.log(
    `\nprobes: ${probes.length} run, ${probes.length - failures.length} caught by the test that names them.`,
  );

  // The other end of the clean-tree check at the top, and it earns its place
  // locally rather than in CI: CI checks out fresh every run, so a patch that
  // was not put back is invisible there and lands on a developer's working copy
  // instead. Every restore happens in a `finally`, which is exactly the kind of
  // claim that stays true until it does not — a crash between the two writes,
  // or a `to` that a later `finally` rewrites over. This is what would notice.
  if (workingTreeIsClean() === false) {
    failures.push(
      "the working tree is dirty after the run: at least one patch was not put back. " +
        "`git diff` shows what is still applied, and `git checkout .` is the recovery.",
    );
    console.error("NOT RESTORED  the working tree did not come back clean");
  }

  if (failures.length > 0) {
    console.error("");
    for (const failure of failures) console.error(`ERROR  ${failure}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
