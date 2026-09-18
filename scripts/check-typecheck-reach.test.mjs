// The typecheck-reach checker, asserted in both halves: a tree that must trip
// it, and the tree one line away that must not.
//
// Every case builds a throwaway workspace. The real one is supposed to be
// clean, so it can only exercise the passing half — and it is asserted once at
// the end, because a checker that passes its fixtures and fails the repository
// it guards would be found by CI rather than here.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkTypecheckReach, projectsOf } from "./check-typecheck-reach.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

const BASE = JSON.stringify({
  compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, types: [] },
});

/**
 * A workspace with one package, `packages/a`, whose tsconfig `include` is the
 * argument. The defaults are the passing shape; each case moves one thing.
 */
function tree({
  workspace = ['"packages/*"'],
  include = ["src"],
  files = { "packages/a/src/index.ts": "export const a = 1;\n" },
  manifests = { "packages/a/package.json": { name: "a", scripts: { typecheck: "tsc --noEmit" } } },
  configs = { "packages/a/tsconfig.json": { extends: "../../tsconfig.base.json", include } },
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "typecheck-reach-"));
  roots.push(root);

  const write = (name, text) => {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  };

  write("pnpm-workspace.yaml", `packages:\n${workspace.map((p) => `  - ${p}\n`).join("")}`);
  write("tsconfig.base.json", BASE);
  for (const [name, body] of Object.entries(manifests)) write(name, JSON.stringify(body));
  for (const [name, body] of Object.entries(configs)) write(name, JSON.stringify(body));
  for (const [name, text] of Object.entries(files)) write(name, text);

  return root;
}

const problems = (options) => checkTypecheckReach(tree(options)).problems;

describe("projectsOf", () => {
  it("defaults to tsconfig.json, as tsc does", () => {
    expect(projectsOf("tsc --noEmit")).toEqual(["tsconfig.json"]);
  });

  it("reads every -p a script names", () => {
    expect(
      projectsOf("tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json"),
    ).toEqual(["tsconfig.json", "tsconfig.test.json"]);
  });
});

describe("1. every project resolves to a source file of its own", () => {
  it("passes a project that sees its sources", () => {
    expect(problems()).toEqual([]);
  });

  it("fails an include that matches nothing", () => {
    // The 2026-09-01 shape: a character class, which tsconfig globs do not
    // know, so the pattern names no file and tsc has nothing to object to.
    const found = problems({ include: ["src/[a-z]*.ts"] });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("resolves to no source file of its own");
  });

  it("fails a project whose only file is a declaration", () => {
    const found = problems({
      include: ["src"],
      files: { "packages/a/src/env.d.ts": "declare const X: string;\n" },
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("resolves to no source file of its own");
  });

  it("does not count files borrowed from another package as its own", () => {
    // `supabase/functions` reaches `packages/law-refs` through `paths`. Those
    // files are in the program, and they are not what this project is credited
    // with checking.
    const found = problems({
      include: ["src/[a-z]*.ts", "../b/src/index.ts"],
      files: { "packages/b/src/index.ts": "export const b = 1;\n" },
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("(1 in all)");
  });

  it("checks every tsconfig the script names", () => {
    const found = problems({
      manifests: {
        "packages/a/package.json": {
          name: "a",
          scripts: {
            typecheck: "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
          },
        },
      },
      configs: {
        "packages/a/tsconfig.json": { extends: "../../tsconfig.base.json", include: ["src"] },
        "packages/a/tsconfig.test.json": {
          extends: "../../tsconfig.base.json",
          include: ["src/**/*.test.ts"],
        },
      },
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("packages/a/tsconfig.test.json");
  });

  it("fails a tsconfig the script names and the package lacks", () => {
    const found = problems({
      manifests: {
        "packages/a/package.json": {
          name: "a",
          scripts: { typecheck: "tsc --noEmit -p tsconfig.build.json" },
        },
      },
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("tsconfig.build.json, which does not exist");
  });
});

describe("2. every typecheck script is in the workspace", () => {
  it("fails a package with a typecheck script that the workspace does not list", () => {
    const found = problems({ workspace: ['"apps/*"'] });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("packages/a/package.json");
    expect(found[0]).toContain("not in pnpm-workspace.yaml");
  });

  it("passes the same package once the workspace names it — as a literal, too", () => {
    expect(problems({ workspace: ['"packages/a"'] })).toEqual([]);
  });

  it("ignores a package outside the workspace that has no typecheck script", () => {
    // A fixture directory with a package.json is not a gate that failed to run.
    expect(
      problems({
        workspace: ['"packages/*"'],
        manifests: {
          "packages/a/package.json": { name: "a", scripts: { typecheck: "tsc --noEmit" } },
          "fixtures/x/package.json": { name: "x" },
        },
      }),
    ).toEqual([]);
  });

  it("does not walk into node_modules", () => {
    expect(
      problems({
        manifests: {
          "packages/a/package.json": { name: "a", scripts: { typecheck: "tsc --noEmit" } },
          "node_modules/dep/package.json": { name: "dep", scripts: { typecheck: "tsc" } },
        },
      }),
    ).toEqual([]);
  });
});

describe("this repository", () => {
  it("is reached in full", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const { problems, projects } = checkTypecheckReach(root);
    expect(problems).toEqual([]);
    // The edge functions carry two projects on purpose (ADR-0024): one for the
    // Deno sources with no ambient types, one for the tests that run on Node.
    expect(projects.filter((p) => p.dir === "supabase/functions")).toHaveLength(2);
  });
});
