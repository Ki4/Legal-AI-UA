#!/usr/bin/env node
// Put the shared packages where Deno can actually see them.
//
// **The failure this exists for.** `supabase functions serve` runs the edge
// runtime in a container that mounts exactly one directory — `supabase/functions`
// — read-only. The import map pointed two levels above it, at
// `packages/law-refs/src/index.ts`, and every tool in this repository agreed
// that was fine: `tsc` resolves it through the workspace symlink, Vitest runs
// `handler.ts` under Node, and the console imports the same package by name. The
// one runtime that could have disagreed was never asked, because Docker was down
// on the day the function landed. The first real request answered
//
//     worker boot error: failed to create the graph:
//     Module not found "file:///…/packages/law-refs/src/index.ts"
//
// **Why a copy and not a move.** The obvious repair is to keep the source inside
// the mount and have `packages/law-refs` re-export it. That would make the
// layout state something false: `apps/console/src/features/law` imports this
// code to normalize a citation a lawyer pasted, and the console does not run on
// Deno. The code is shared domain logic, which is what `packages/` is for; the
// mount is a constraint of one runtime's tooling, not a claim about who owns the
// code. So the package stays where it belongs and a copy goes where Deno looks.
//
// **Why the copy is generated and git-ignored rather than committed and
// checked.** A committed copy is drift that a gate has to notice, and this whole
// task exists because a gate that nobody had run was carrying an untrue claim.
// Regenerating on the way into every `serve` and every `deploy` makes drift
// impossible rather than detectable — there is no state to be stale, because the
// copy never outlives the command that made it.
//
// The corollary, stated because it is the thing that will surprise somebody: a
// fresh checkout has no `_shared/`, so `deno run` against a function fails until
// this has run. `pnpm functions:serve` and `pnpm functions:deploy` run it; a
// bare `supabase functions serve` does not, and that is the one way back into
// the failure above.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What is copied, and where it lands under `supabase/functions/_shared/`.
 *
 * A list rather than a glob over `packages/`, because one function imports one
 * package and copying the rest would put React into a Deno bundle.
 *
 * **`core-client` is deliberately not here yet, though ADR-0020 has the gateway
 * importing it.** Adding it ahead of that import was the first thing tried, and
 * it copied `schema-walk.ts`, which opens `node:fs` — a module the Deno gateway
 * does not have, sitting in a bundle nothing loads, waiting to be discovered by
 * whoever first wires the gateway up. That is the same shape as the failure this
 * file exists for: a claim about a runtime, made by tooling that never asks it.
 * The line goes in on the day something imports it and the runtime can answer.
 */
export const SHARED_PACKAGES = [{ name: "law-refs", from: "packages/law-refs/src" }];

/**
 * Tests and their fixtures stay behind.
 *
 * They run under Vitest against the original, which is the copy's whole point —
 * what Deno loads is proved by the same files the console is proved by. Copying
 * them would put 116 KB of saved HTML into every function bundle to be loaded by
 * nothing.
 */
function isRuntimeFile(name) {
  return name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts");
}

export function syncEdgeShared(root) {
  const target = resolve(root, "supabase/functions/_shared");
  const copied = [];

  rmSync(target, { recursive: true, force: true });

  for (const pkg of SHARED_PACKAGES) {
    const source = resolve(root, pkg.from);
    if (!existsAsDirectory(source)) continue;

    const destination = join(target, pkg.name);
    mkdirSync(destination, { recursive: true });

    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        cpSync(join(source, entry.name), join(destination, entry.name), {
          recursive: true,
          filter: (path) => statSync(path).isDirectory() || isRuntimeFile(path),
        });
        continue;
      }
      if (isRuntimeFile(entry.name)) {
        cpSync(join(source, entry.name), join(destination, entry.name));
        copied.push(`${pkg.name}/${entry.name}`);
      }
    }
  }

  return { target, copied };
}

function existsAsDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { copied } = syncEdgeShared(root);

  if (copied.length === 0) {
    console.error(
      "ERROR  nothing was copied into supabase/functions/_shared — is the tree intact?",
    );
    process.exit(1);
  }

  console.log(`edge shared: ${copied.length} file(s) into supabase/functions/_shared/.`);
}

// Runs its CLI only when invoked as one, so a test can sync a throwaway tree
// without touching this repository or exiting the runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
