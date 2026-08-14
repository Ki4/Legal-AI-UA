// `py-lane.mjs` went through two review passes — one of them mine, one an
// agent's — and a command injection survived both. Everything either of us
// looked at was correctness on the happy path: does it find ruff, does it
// propagate the exit code, do the probe and the invocation agree. The question
// nobody asked was *where do these arguments come from*, and the answer is the
// one input in the whole script that is not ours: staged file paths.
//
// So the last describe block does not assert a shape. It hands the built
// command line to a real `cmd.exe` and checks the injected half does not run,
// which is the demonstration that settled it when the defect was found. The
// rest of this file covers the resolution and quoting rules around it.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCmdLine, firstResolvedPath, needsCmdWrapper, unsafeCmdArgs } from "./py-lane.mjs";

describe("firstResolvedPath", () => {
  it("takes the first of several matches, which is the one PATH would run", () => {
    const stdout = "C:\\tools\\ruff.exe\r\nC:\\other\\ruff.exe\r\n";

    expect(firstResolvedPath(stdout)).toBe("C:\\tools\\ruff.exe");
  });

  it("handles both line endings, since `where` and `which` disagree", () => {
    expect(firstResolvedPath("/usr/local/bin/ruff\n")).toBe("/usr/local/bin/ruff");
    expect(firstResolvedPath("C:\\tools\\ruff.exe\r\n")).toBe("C:\\tools\\ruff.exe");
  });

  it("returns null rather than an empty string when nothing was found", () => {
    // The caller branches on `=== null`. An empty string here would be a path
    // this script then tries to spawn.
    expect(firstResolvedPath("")).toBeNull();
    expect(firstResolvedPath("   \r\n  \n")).toBeNull();
    expect(firstResolvedPath(undefined)).toBeNull();
  });
});

describe("needsCmdWrapper", () => {
  it("wraps a .cmd or .bat on Windows, in any case", () => {
    // The real one: `where ruff` finds a `node_modules/.bin` shim named
    // `ruff.CMD`, which `CreateProcess` cannot run at all.
    expect(needsCmdWrapper("win32", "C:\\p\\node_modules\\.bin\\ruff.CMD")).toBe(true);
    expect(needsCmdWrapper("win32", "C:\\p\\ruff.cmd")).toBe(true);
    expect(needsCmdWrapper("win32", "C:\\p\\ruff.bat")).toBe(true);
  });

  it("leaves a native executable alone, so no shell is involved at all", () => {
    expect(needsCmdWrapper("win32", "C:\\tools\\ruff.exe")).toBe(false);
    expect(needsCmdWrapper("linux", "/usr/local/bin/ruff")).toBe(false);
  });

  it("does not wrap a .cmd off Windows, where the extension means nothing", () => {
    expect(needsCmdWrapper("linux", "/usr/local/bin/ruff.cmd")).toBe(false);
    expect(needsCmdWrapper("darwin", "/usr/local/bin/ruff.cmd")).toBe(false);
  });
});

describe("unsafeCmdArgs", () => {
  it("refuses what quoting cannot make inert", () => {
    // `cmd.exe` expands `%FOO%` inside quotes too, and a `/c` line has no
    // dependable escape for a quote character.
    expect(unsafeCmdArgs(["apps/core/%PATH%.py"])).toEqual(["apps/core/%PATH%.py"]);
    expect(unsafeCmdArgs(['apps/core/a".py'])).toEqual(['apps/core/a".py']);
  });

  it("allows what quoting does make inert", () => {
    // This is the distinction the whole design rests on. `&` is exactly the
    // character the injection used, and it is *safe* here — because the token
    // is quoted rather than handed to a shell as text.
    expect(unsafeCmdArgs(["apps/core/x & calc.py"])).toEqual([]);
    expect(unsafeCmdArgs(["apps/core/a|b.py", "apps/core/(c).py", "apps/core/d e.py"])).toEqual([]);
  });

  it("names every offending path, not just the first", () => {
    expect(unsafeCmdArgs(["ok.py", "%a%.py", "b.py", '"c".py'])).toEqual(["%a%.py", '"c".py']);
  });
});

describe("buildCmdLine", () => {
  it("quotes every token and wraps the whole line once more for /s", () => {
    expect(buildCmdLine("C:\\p\\ruff.cmd", ["format", "a.py"])).toBe(
      '""C:\\p\\ruff.cmd" "format" "a.py""',
    );
  });

  it("keeps a metacharacter inside its own quotes", () => {
    const line = buildCmdLine("C:\\p\\ruff.cmd", ["format", "x & calc.py"]);

    expect(line).toContain('"x & calc.py"');
    // The shape that mattered: the `&` never appears between two quoted
    // tokens, which is where cmd.exe would read it as a separator.
    expect(line).not.toContain('" & "');
  });
});

// Windows only, and stated rather than hidden: CI runs on ubuntu-latest, so
// this block is skipped there and the guard it covers is exercised on a
// developer machine. The alternative — asserting on the string alone — is what
// the two review passes already did.
describe.skipIf(process.platform !== "win32")("the built line, given to a real cmd.exe", () => {
  // A script file rather than `node -e`: an inline script would put `(`, `)`
  // and `|` on the command line, and the unquoted probe below needs a line
  // whose *only* metacharacter is the one in the hostile filename. Otherwise
  // the probe fails for the wrong reason and proves nothing.
  const HOSTILE = "apps/core/x & echo INJECTED";
  let echoArgs;

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), "py-lane-"));
    echoArgs = join(dir, "echo-args.cjs");
    writeFileSync(echoArgs, "console.log(process.argv.slice(2).join(String.fromCharCode(10)));\n");
  });

  afterAll(() => {
    rmSync(dirname(echoArgs), { recursive: true, force: true });
  });

  function runLine(line) {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", line], {
      encoding: "utf8",
      windowsVerbatimArguments: true,
    });
  }

  /** Did cmd.exe run a second command, rather than pass the text through? */
  function injectedRan(stdout) {
    return stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .includes("INJECTED");
  }

  it("passes a hostile filename through as one argument", () => {
    const result = runLine(buildCmdLine(process.execPath, [echoArgs, HOSTILE]));

    expect(result.status).toBe(0);
    // The whole filename arrived, `&` and all, as a single argv entry.
    expect(result.stdout).toContain(HOSTILE);
    expect(injectedRan(result.stdout)).toBe(false);
  });

  it("and the unquoted form this replaced does run it", () => {
    // The probe, kept rather than described: without it the test above passes
    // just as well against a `cmd.exe` that never runs anything at all. This is
    // the shape `shell: true` builds — tokens joined with spaces, unquoted.
    const result = runLine(`${process.execPath} ${echoArgs} ${HOSTILE}`);

    expect(injectedRan(result.stdout)).toBe(true);
  });
});
