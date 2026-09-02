// The cloud-ledger checker, asserted rule by rule and in both halves.
//
// Written before the checker it tests, per the ordering rule in the DoD: a test
// written from finished code inherits that code's mistakes.
//
// Every case hands `compareLedger` a list of rows rather than calling the
// Supabase CLI. The comparison is the part with a rule in it; reaching the
// cloud is plumbing, and plumbing that needs a network and a credential cannot
// be asserted in both halves. What the CLI half gets instead is
// `parseLedgerOutput`, which is where the two ways this check can go quietly
// wrong actually live: output that is not the JSON we asked for, and a run that
// failed while printing something parseable-looking.

import { describe, expect, it } from "vitest";
import { compareLedger, parseLedgerOutput } from "./check-cloud-ledger.mjs";

const agreed = (version) => ({ local: version, remote: version, time: "2026-08-01 12:00:00" });
const pending = (version) => ({ local: version, remote: "", time: "2026-08-30 12:00:00" });
const untracked = (version) => ({ local: "", remote: version, time: "2026-08-30 12:00:00" });

describe("compareLedger", () => {
  it("passes when every migration is on both sides", () => {
    const { problems, agreedCount } = compareLedger([
      agreed("20260730120000"),
      agreed("20260801120000"),
    ]);

    expect(problems).toEqual([]);
    expect(agreedCount).toBe(2);
  });

  it("fails on a migration in the repository that the cloud has not applied", () => {
    const { problems } = compareLedger([agreed("20260730120000"), pending("20260830120000")]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("20260830120000");
    expect(problems[0]).toContain("not applied");
  });

  it("fails on a migration the cloud has that no file in the repository matches", () => {
    const { problems } = compareLedger([agreed("20260730120000"), untracked("20260830120000")]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("20260830120000");
    expect(problems[0]).toContain("by hand");
  });

  // The two directions are not the same defect and the message has to say so:
  // one is a push that has not happened, the other is a schema nobody can
  // reproduce. A checker that reported them identically would send the reader
  // to `db push` in the case where `db push` is exactly wrong.
  it("tells the two directions apart", () => {
    const { problems } = compareLedger([pending("20260830120000"), untracked("20260829120000")]);

    expect(problems).toHaveLength(2);
    expect(problems.filter((p) => p.includes("not applied"))).toHaveLength(1);
    expect(problems.filter((p) => p.includes("by hand"))).toHaveLength(1);
  });

  // 2026-09-02: the message for this direction used to end "`supabase db push`
  // is what closes it". That day both migrations were already in the cloud,
  // run through the dashboard's SQL editor, and a push would have died on the
  // first `create type ... already exists`. A missing ledger row does not say
  // which of the two happened, so the message may not choose for the reader —
  // while the other direction, where the evidence is unambiguous, still must.
  it("defers on a missing ledger row and still directs on a hand-made change", () => {
    const { problems } = compareLedger([pending("20260830120000"), untracked("20260829120000")]);

    const [unapplied, handMade] = problems;

    expect(unapplied).toContain("never ran anywhere");
    expect(unapplied).toContain("supabase/CLAUDE.md");
    expect(handMade).toContain("recover the SQL first");
  });

  it("treats an empty ledger as a failure rather than a clean run", () => {
    // Nothing local and nothing remote is not agreement. It is the shape a
    // wrong `--workdir`, an unlinked project, or a silently-empty response
    // produces, and it is the shape that reads as green.
    const { problems } = compareLedger([]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("no migrations");
  });
});

describe("parseLedgerOutput", () => {
  it("reads the migration rows out of a successful run", () => {
    const rows = parseLedgerOutput(
      'Connecting to remote database...\n{"migrations":[{"local":"20260730120000","remote":"20260730120000","time":"t"}],"message":"Migrations listed"}',
      0,
    );

    expect(rows).toEqual([{ local: "20260730120000", remote: "20260730120000", time: "t" }]);
  });

  // The reason this function exists. `supabase` detects an agent on stdout and
  // switches to JSON on its own, so a run under Claude Code prints JSON while
  // the same command in a human terminal prints an ASCII table. The checker
  // pins `--output-format json`, and this asserts that a table is a failure
  // rather than a parse that finds zero rows and calls the ledger clean.
  it("refuses table output instead of finding zero rows in it", () => {
    const table =
      "        Local      |     Remote     |     Time    \n  `20260830120000` | ` ` | `2026-08-30 12:00:00`";

    expect(() => parseLedgerOutput(table, 0)).toThrow(/not JSON/);
  });

  it("refuses a failed run even when its output parses", () => {
    expect(() => parseLedgerOutput('{"migrations":[],"message":"failed"}', 1)).toThrow(/exited 1/);
  });

  // Missing credentials must fail, not skip. This is the defect STATE.md
  // records twice under a different name: a project that sees no files
  // typechecks clean. A gate that skips itself in CI when a secret is absent is
  // the same gate.
  it("refuses a run that could not authenticate", () => {
    expect(() =>
      parseLedgerOutput("Access token not provided. Supply an access token by running...", 1),
    ).toThrow(/exited 1/);
  });
});
