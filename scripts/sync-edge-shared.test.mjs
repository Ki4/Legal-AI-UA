// The edge-shared sync, asserted in both halves.
//
// The half that is easy to write is "the runtime files arrive". The half that
// matters is everything this copy must *not* contain, and why: a `.test.ts` or a
// fixture in the bundle is dead weight the edge runtime downloads and parses,
// and a file left behind from a previous run is exactly the drift that
// generating the copy was supposed to make impossible. A sync that only ever
// added files would pass the first half forever while the second rotted.
//
// Every case builds a throwaway tree. The real `packages/law-refs` is supposed
// to be well-formed, so it can only exercise the passing half.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SHARED_PACKAGES, syncEdgeShared } from "./sync-edge-shared.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

/** A tree with `packages/law-refs/src` filled from `files`, plus anything extra. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "edge-shared-"));
  roots.push(root);

  for (const [name, body] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }

  return root;
}

function shared(root, ...parts) {
  return join(root, "supabase/functions/_shared", ...parts);
}

describe("syncEdgeShared", () => {
  it("copies the package's runtime source where the edge runtime's mount can reach it", () => {
    const root = tree({
      "packages/law-refs/src/index.ts": "export * from './link.ts';\n",
      "packages/law-refs/src/link.ts": "export const normalizeLawLink = () => null;\n",
    });

    const { copied } = syncEdgeShared(root);

    expect(copied).toEqual(["law-refs/index.ts", "law-refs/link.ts"]);
    expect(existsSync(shared(root, "law-refs/index.ts"))).toBe(true);
    expect(existsSync(shared(root, "law-refs/link.ts"))).toBe(true);
  });

  it("leaves the tests and their type shims behind", () => {
    // They run under Vitest against the original, which is the point of copying
    // rather than moving: what Deno loads is proved by the files the console is
    // proved by. `fixtures.d.ts` describes an import only a test makes.
    const root = tree({
      "packages/law-refs/src/index.ts": "export const version = 1;\n",
      "packages/law-refs/src/link.test.ts": "throw new Error('never loaded by Deno');\n",
      "packages/law-refs/src/fixtures.d.ts": "declare module '*.html';\n",
    });

    const { copied } = syncEdgeShared(root);

    expect(copied).toEqual(["law-refs/index.ts"]);
    expect(existsSync(shared(root, "law-refs/link.test.ts"))).toBe(false);
    expect(existsSync(shared(root, "law-refs/fixtures.d.ts"))).toBe(false);
  });

  it("removes what a previous run left, so the copy cannot go stale", () => {
    // The reason the copy is generated and git-ignored rather than committed and
    // checked. A sync that only added files would serve a module the source had
    // deleted, and no gate in this repository would have an opinion about it.
    const root = tree({
      "packages/law-refs/src/index.ts": "export const version = 2;\n",
      "supabase/functions/_shared/law-refs/removed.ts": "export const gone = true;\n",
      "supabase/functions/_shared/core-client/index.ts": "export const speculative = true;\n",
    });

    syncEdgeShared(root);

    expect(existsSync(shared(root, "law-refs/removed.ts"))).toBe(false);
    expect(existsSync(shared(root, "core-client"))).toBe(false);
    expect(readdirSync(shared(root))).toEqual(["law-refs"]);
  });

  it("copies nothing at all rather than half a package, when the source is not there", () => {
    // What the CLI turns into a non-zero exit. A sync that reported success over
    // an empty directory would hand `serve` an import map pointing at nothing,
    // which is the boot error this whole file exists to have fixed once.
    const root = tree({ "packages/law-refs/package.json": "{}\n" });

    const { copied } = syncEdgeShared(root);

    expect(copied).toEqual([]);
  });

  it("names only packages that a function may actually load", () => {
    // `core-client` was on this list for one commit. It carries `schema-walk.ts`,
    // which opens `node:fs` — absent from the Deno gateway — so the copy would
    // have shipped a broken module ahead of anything importing it. The assertion
    // is deliberately about the list rather than about a tree: what makes a
    // package safe to copy is that a runtime has answered for it.
    expect(SHARED_PACKAGES.map((pkg) => pkg.name)).toEqual(["law-refs"]);
  });
});
