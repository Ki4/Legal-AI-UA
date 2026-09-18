#!/usr/bin/env node
// Does `pnpm typecheck` reach every file it is credited with reaching?
//
// Two ways for it not to, both silent, both seen on 2026-09-01:
//
//   1. A tsconfig whose `include` matches no file typechecks clean. tsconfig
//      globs know `*`, `?` and `**` and nothing else, so `*/[a-z]*.ts` is a
//      pattern that names nothing, and `tsc` over nothing reports nothing.
//      `supabase/functions` was green for one commit that way; `tsc
//      --listFiles` was how it was noticed, by a person, after the fact.
//
//   2. A package `pnpm-workspace.yaml` does not list is a package turbo never
//      visits. Its `typecheck` script exists, reads correctly in review, and
//      runs on nobody's machine and in no CI job. Adding a shared package
//      touches three places — the directory, the workspace file and whoever
//      imports it — and until this file, only a sentence in STATE said so.
//
// A gate reported green is not a gate that ran. This checker runs before
// `turbo run typecheck` and fails when either shape is present, so the next
// green means what it says. It asks TypeScript itself which files each project
// resolves to (`parseJsonConfigFileContent`), which is what `tsc` would do,
// without compiling any of them — the whole check is a fraction of a second.
//
// The check is a function of a directory rather than of this repository, and
// the CLI runs only when this file is invoked as one, so the test can hand it a
// tree that is deliberately wrong.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Directories a walk for `package.json` files never enters. */
const SKIPPED = new Set(["node_modules", ".git", ".turbo", "dist", "build", "coverage"]);

const slash = (path) => path.split("\\").join("/");

/**
 * The package directories `pnpm-workspace.yaml` names, resolved. The file is
 * read with a regex rather than a YAML parser because it holds one list of
 * quoted strings and comments, and a dependency for that is a dependency.
 * Patterns are a literal directory or a directory with a trailing `/*` — the
 * two shapes pnpm's documentation leads with, and the two this repository uses.
 */
export function workspacePackages(root) {
  const text = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const patterns = [...text.matchAll(/^\s*-\s*["']?([^"'#\n]+?)["']?\s*$/gm)].map((m) => m[1]);

  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const parent = join(root, pattern.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(parent, entry.name, "package.json"))) {
          dirs.push(join(parent, entry.name));
        }
      }
    } else if (existsSync(join(root, pattern, "package.json"))) {
      dirs.push(join(root, pattern));
    }
  }
  return dirs;
}

/** Every `package.json` under `root`, skipping what no workspace would include. */
function packageManifests(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.name === "package.json" && dir !== root) {
        found.push(dir);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * The tsconfig files a `typecheck` script names: each `-p x` or `--project x`,
 * or `tsconfig.json` when it names none — which is what `tsc` defaults to.
 */
export function projectsOf(script) {
  const named = [...script.matchAll(/(?:-p|--project)\s+(\S+)/g)].map((m) => m[1]);
  return named.length > 0 ? named : ["tsconfig.json"];
}

/** The source files a tsconfig resolves to — declarations excluded, since a project of only `.d.ts` checks nothing. */
export function sourceFilesOf(configPath) {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error !== undefined)
    return { error: ts.flattenDiagnosticMessageText(read.error.messageText, "\n") };

  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
  const fatal = parsed.errors.find(
    (e) => e.category === ts.DiagnosticCategory.Error && e.code !== 18003,
  );
  if (fatal !== undefined)
    return { error: ts.flattenDiagnosticMessageText(fatal.messageText, "\n") };

  return { files: parsed.fileNames.filter((file) => !file.endsWith(".d.ts")) };
}

export function checkTypecheckReach(root) {
  const problems = [];
  const projects = [];
  const inWorkspace = new Set(workspacePackages(root).map((dir) => slash(resolve(dir))));

  for (const dir of packageManifests(root)) {
    const rel = slash(relative(root, dir));
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    const script = manifest.scripts?.typecheck;
    if (typeof script !== "string") continue;

    // 2. A typecheck script turbo cannot see.
    if (!inWorkspace.has(slash(resolve(dir)))) {
      problems.push(
        `${rel}/package.json has a \`typecheck\` script and is not in pnpm-workspace.yaml, ` +
          `so \`turbo run typecheck\` never runs it. Its green is nobody's.`,
      );
      continue;
    }

    // 1. A project that resolves to no source file.
    for (const project of projectsOf(script)) {
      const configPath = join(dir, project);
      if (!existsSync(configPath) || !statSync(configPath).isFile()) {
        problems.push(`${rel}: \`typecheck\` names ${project}, which does not exist.`);
        continue;
      }

      const result = sourceFilesOf(configPath);
      if (result.error !== undefined) {
        problems.push(`${rel}/${project}: ${result.error}`);
        continue;
      }

      const own = result.files.filter((file) => slash(file).startsWith(slash(resolve(dir)) + "/"));
      projects.push({ dir: rel, project, files: result.files.length, own: own.length });

      if (own.length === 0) {
        problems.push(
          `${rel}/${project} resolves to no source file of its own (${result.files.length} in all). ` +
            `A project that sees nothing typechecks clean — check \`include\`: tsconfig globs know ` +
            `\`*\`, \`?\` and \`**\` only, and a character class matches no file.`,
        );
      }
    }
  }

  return { problems, projects };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, projects } = checkTypecheckReach(root);

  for (const problem of problems) console.error(`ERROR  ${problem}`);

  if (problems.length > 0) {
    console.error(
      `\n${problems.length} problem(s): \`pnpm typecheck\` would not reach what it is credited with.`,
    );
    process.exit(1);
  }

  const files = projects.reduce((sum, p) => sum + p.own, 0);
  console.log(
    `typecheck: ${projects.length} project(s) resolve to ${files} source file(s) of their own.`,
  );
}

// Runs its CLI only when invoked as one, so a test can call `checkTypecheckReach`
// on a throwaway tree without walking this repository or exiting the runner.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
