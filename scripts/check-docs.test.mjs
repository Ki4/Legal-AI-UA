// The documentation checker, asserted rule by rule and in both halves: a tree
// that must trip the rule, and the tree one character away that must not.
//
// This file is itself the answer to a debt carried from 2026-08-14 — the two
// oldest checkers were the ones nothing executed, which is the exact defect they
// were written to catch, one level up.
//
// Every case builds a throwaway docs tree rather than asserting against the real
// repository. Asserting against the repository would make these tests fail
// whenever somebody edits a real document, which trains people to "fix" the test
// by loosening it; and it could never exercise the failing half at all, because
// the repository is supposed to be clean.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocs } from "./check-docs-lib.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

/**
 * A tree that passes every rule, with `files` layered on top.
 *
 * The baseline matters as much as the overrides: a fixture that fails two rules
 * at once cannot tell you which one the assertion caught.
 */
function tree(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "docs-check-"));
  roots.push(root);

  const written = {
    "docs/STATE.md": "# State\n\nNothing carried.\n",
    "docs/ROADMAP.md": "# Roadmap\n\n## Done — one (2026-08-27)\n",
    "docs/adr/0001-a-decision.md": "# ADR-0001\n",
    ...files,
  };

  for (const [name, text] of Object.entries(written)) {
    if (text === null) continue;
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  }

  return root;
}

const problems = (files) => checkDocs(tree(files)).problems;
const notes = (files) => checkDocs(tree(files)).notes;
const matching = (list, needle) => list.filter((entry) => entry.includes(needle));

describe("1. relative links resolve", () => {
  it("fails a link to a file that is not there, and passes the one that is", () => {
    expect(
      matching(problems({ "docs/a.md": "[gone](./nowhere.md)" }), "does not exist"),
    ).toHaveLength(1);

    expect(
      matching(problems({ "docs/a.md": "[here](./b.md)", "docs/b.md": "# B\n" }), "does not exist"),
    ).toHaveLength(0);
  });

  it("leaves external and anchor-only links alone", () => {
    // A checker that tried to resolve `https://` would either hit the network or
    // report every external link as broken. Both make it useless.
    const text = "[web](https://example.test) [mail](mailto:a@b.test) [top](#heading)";
    expect(matching(problems({ "docs/a.md": text }), "does not exist")).toHaveLength(0);
  });

  it("resolves a link that carries an anchor by its file half", () => {
    expect(
      matching(
        problems({ "docs/a.md": "[part](./b.md#section)", "docs/b.md": "# B\n" }),
        "does not exist",
      ),
    ).toHaveLength(0);
  });
});

describe("2. section cross-references resolve", () => {
  const doc = (body) => `# Spec\n\n## 1. First\n\n### 1.2 Second\n\n${body}\n`;

  it("fails a § pointing at a section that does not exist, and passes one that does", () => {
    expect(matching(problems({ "docs/spec.md": doc("See §9.4.") }), "§9.4")).toHaveLength(1);
    expect(
      matching(problems({ "docs/spec.md": doc("See §1.2.") }), "no such section"),
    ).toHaveLength(0);
  });

  it("skips a document that numbers no sections at all", () => {
    // The known limit, asserted so that closing it later is a deliberate change
    // rather than a surprise: a stray §-reference in ROADMAP goes unnoticed.
    expect(
      matching(problems({ "docs/a.md": "# Plain\n\nSee §9.4.\n" }), "no such section"),
    ).toHaveLength(0);
  });
});

describe("3. every backlog id cited has a row", () => {
  const table = (rows) =>
    `# Spec\n\n| id | what | Depends | Size |\n| --- | --- | --- | --- |\n${rows}`;

  it("fails an id with no row, and passes once the row exists", () => {
    expect(
      matching(
        problems({ "docs/spec.md": table("| ADM-1 | A | — | S |\n\nSee ADM-2.\n") }),
        "ADM-2",
      ),
    ).toHaveLength(1);

    expect(
      matching(
        problems({ "docs/spec.md": table("| ADM-1 | A | — | S |\n| ADM-2 | B | — | S |\n") }),
        "has no row",
      ),
    ).toHaveLength(0);
  });

  it("leaves a document alone when it only cites ids defined elsewhere", () => {
    expect(matching(problems({ "docs/a.md": "ADM-42 is next.\n" }), "has no row")).toHaveLength(0);
  });
});

describe("4. an orphaned ADR is a note, never a failure", () => {
  it("notes an ADR nothing cites, and says nothing once something does", () => {
    expect(matching(notes({}), "ADR-0001")).toHaveLength(1);
    expect(matching(problems({}), "ADR-0001")).toHaveLength(0);

    expect(matching(notes({ "docs/a.md": "See ADR-0001.\n" }), "ADR-0001")).toHaveLength(0);
  });
});

describe("5. the tier-1 budgets", () => {
  it("fails STATE at 61 lines and passes it at 60", () => {
    const state = (lines) =>
      `${Array.from({ length: lines - 1 }, (_, i) => `line ${i}`).join("\n")}\n`;

    expect(matching(problems({ "docs/STATE.md": state(61) }), "budget is 60")).toHaveLength(1);
    expect(matching(problems({ "docs/STATE.md": state(60) }), "budget is 60")).toHaveLength(0);
  });

  it("fails a fourth `## Done` section and passes three", () => {
    const roadmap = (n) =>
      `# Roadmap\n\n${Array.from({ length: n }, (_, i) => `## Done — ${i} (2026-08-27)`).join("\n\n")}\n`;

    expect(matching(problems({ "docs/ROADMAP.md": roadmap(4) }), "budget is 3")).toHaveLength(1);
    expect(matching(problems({ "docs/ROADMAP.md": roadmap(3) }), "budget is 3")).toHaveLength(0);
  });

  it("treats a missing budgeted file as a failure rather than a silent pass", () => {
    // This is the bug the comment in the checker describes: the lookup used to
    // miss, `undefined` was skipped, and the budget reported clean while
    // measuring nothing. A skip and a pass are indistinguishable in the output,
    // which is what made it survive.
    expect(matching(problems({ "docs/STATE.md": null }), "missing")).toHaveLength(1);
  });
});

describe("6. an old debt is a note with its age", () => {
  const dated = (daysAgo) => {
    const when = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    return `# State\n\n- \`${when}\` something carried\n`;
  };

  it("notes a debt past three weeks and stays quiet inside them", () => {
    expect(matching(notes({ "docs/STATE.md": dated(22) }), "has been carried")).toHaveLength(1);
    expect(matching(notes({ "docs/STATE.md": dated(20) }), "has been carried")).toHaveLength(0);
  });

  it("never fails the build over one", () => {
    // Deliberate: a check that failed here would be answered by deleting the
    // line rather than by closing the debt.
    expect(matching(problems({ "docs/STATE.md": dated(400) }), "has been carried")).toHaveLength(0);
  });
});

describe("7. the Depends column is at least buildable", () => {
  const spec = (rows) =>
    `# Spec\n\n| id | what | Depends | Size |\n| --- | --- | --- | --- |\n${rows}`;

  it("fails a row that depends on itself, and passes the row that depends on another", () => {
    expect(
      matching(problems({ "docs/spec.md": spec("| ADM-1 | A | ADM-1 | S |\n") }), "itself"),
    ).toHaveLength(1);

    expect(
      matching(
        problems({ "docs/spec.md": spec("| ADM-1 | A | — | S |\n| ADM-2 | B | ADM-1 | S |\n") }),
        "itself",
      ),
    ).toHaveLength(0);
  });

  it("fails a cycle and names it, and passes the same rows with the loop broken", () => {
    const cyclic = spec(
      "| ADM-1 | A | ADM-3 | S |\n| ADM-2 | B | ADM-1 | S |\n| ADM-3 | C | ADM-2 | S |\n",
    );
    const acyclic = spec(
      "| ADM-1 | A | — | S |\n| ADM-2 | B | ADM-1 | S |\n| ADM-3 | C | ADM-2 | S |\n",
    );

    const found = matching(problems({ "docs/spec.md": cyclic }), "forms a cycle");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/ADM-\d+ → ADM-\d+ → ADM-\d+ → ADM-\d+/);

    expect(matching(problems({ "docs/spec.md": acyclic }), "forms a cycle")).toHaveLength(0);
  });

  it("reads a cell holding several dependencies as several", () => {
    // `ADM-48 | ... | ADM-46, ADM-47` is the real shape in the backlog. A parser
    // taking only the first id would let a cycle through the second.
    const text = spec(
      "| ADM-1 | A | ADM-2, ADM-3 | S |\n| ADM-2 | B | — | S |\n| ADM-3 | C | ADM-1 | S |\n",
    );

    expect(matching(problems({ "docs/spec.md": text }), "forms a cycle")).toHaveLength(1);
  });

  it("says nothing about whether a dependency is the right one", () => {
    // The half no gate can hold, asserted so nobody reads a green check as more
    // than it is: ADM-2 depending on ADM-1 is well-formed whether or not it is
    // true of the work.
    expect(
      problems({ "docs/spec.md": spec("| ADM-1 | A | — | S |\n| ADM-2 | B | ADM-1 | S |\n") }),
    ).toEqual([]);
  });
});
