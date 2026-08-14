// `check-copy.mjs` is a gate, and until now the only evidence it worked was
// that every rule had been watched going red against a probe file by hand. That
// is evidence with a shelf life: it expires the moment the file is edited and
// nobody repeats the exercise. It is also the same shape as the defects the
// checker exists to catch — the thing that would have gone red was never run.
//
// Each rule gets both halves here: a source that must trip it, and the source
// one line away that must not. A checker that flags everything and a checker
// that flags nothing are equally useless, and only the pair distinguishes them.

import { describe, expect, it } from "vitest";
import { checkSource } from "./check-copy.mjs";

/** The problems for one probe source, as plain strings. */
function problemsIn(source) {
  return checkSource("probe.tsx", source).problems;
}

function countsIn(source) {
  return checkSource("probe.tsx", source).counts;
}

describe("rule 1 — JSX text", () => {
  it("flags a hardcoded sentence", () => {
    const problems = problemsIn(`export const A = () => <p>Make accountable</p>;`);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("probe.tsx:1:");
    expect(problems[0]).toContain("Make accountable");
    expect(problems[0]).toContain("packages/i18n");
  });

  it("passes a dictionary lookup", () => {
    expect(problemsIn(`export const A = () => <p>{t("service.assign")}</p>;`)).toEqual([]);
  });

  it("passes punctuation and entities, which carry no words to translate", () => {
    // A regex over the same file would flag all three, which is how a checker
    // gets switched off in its first week.
    expect(problemsIn(`export const A = () => <p>—</p>;`)).toEqual([]);
    expect(problemsIn(`export const A = () => <span>&nbsp;/&nbsp;</span>;`)).toEqual([]);
    expect(problemsIn(`export const A = () => <span>· 42 ·</span>;`)).toEqual([]);
  });

  it("counts what it considered, not only what it flagged", () => {
    // The summary line's whole purpose: "found nothing" and "looked at nothing"
    // are the two states this repository keeps confusing.
    expect(countsIn(`export const A = () => <p>—</p>;`).jsxText).toBe(1);
  });
});

describe("rule 2 — user-visible attributes", () => {
  it("flags a hardcoded placeholder", () => {
    const problems = problemsIn(`export const A = () => <input placeholder="Search services" />;`);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('placeholder="Search services"');
  });

  it("flags aria-label, which no screen shows and every screen reader reads", () => {
    expect(problemsIn(`export const A = () => <button aria-label="Close" />;`)).toHaveLength(1);
  });

  it("passes an attribute fed from the dictionary", () => {
    expect(
      problemsIn(
        `export const A = () => <input placeholder={t("catalogue.search.placeholder")} />;`,
      ),
    ).toEqual([]);
  });

  it("ignores attributes nobody reads", () => {
    expect(problemsIn(`export const A = () => <input name="query" type="search" />;`)).toEqual([]);
  });
});

describe("rule 3 — singular/plural picked by hand", () => {
  it("flags a count === 1 ternary carrying copy", () => {
    const problems = problemsIn(
      `export const A = ({ n }: { n: number }) => <p>{n === 1 ? "service matches" : "services match"}</p>;`,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("tCount");
    expect(problems[0]).toContain("three plural forms");
  });

  it("flags it whichever side the literal 1 is on, and through !==", () => {
    expect(
      problemsIn(`export const A = ({ n }: { n: number }) => <p>{1 !== n ? "many" : "one"}</p>;`),
    ).toHaveLength(1);
  });

  it("passes a ternary whose branches are dictionary lookups", () => {
    // The branches hold string literals — as arguments to `t`. Descending into
    // them would make the rule unusable, since the correct form contains keys.
    expect(
      problemsIn(
        `export const A = ({ n }: { n: number }) => <p>{n === 1 ? t("a.one") : t("a.many")}</p>;`,
      ),
    ).toEqual([]);
  });

  it("passes a comparison to something other than one", () => {
    expect(
      problemsIn(`export const A = ({ n }: { n: number }) => <p>{n === 0 ? "none" : "some"}</p>;`),
    ).toEqual([]);
  });
});

describe("rule 4 — error.message reaching a reader", () => {
  it("flags it inside JSX", () => {
    const problems = problemsIn(
      `export const A = ({ error }: { error: Error }) => <p>{error.message}</p>;`,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("developer text");
  });

  it("flags it inside a t-like call, however deep", () => {
    expect(
      problemsIn(
        `export const A = ({ signInError }: { signInError: Error }) => <p>{t("x", { detail: signInError.message })}</p>;`,
      ),
    ).toHaveLength(1);
  });

  it("passes it on its way to a log, where developer text belongs", () => {
    const source = `export function A({ error }: { error: Error }) { console.error(error.message); return null; }`;

    expect(problemsIn(source)).toEqual([]);
    // Considered and cleared, rather than never looked at.
    expect(countsIn(source).errorMessages).toBe(1);
  });
});

describe("rule 5 — Intl without a locale", () => {
  it("flags a formatter constructed with no locale", () => {
    const problems = problemsIn(`export const f = () => new Intl.NumberFormat();`);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("intlLocale");
  });

  it("flags toLocaleDateString called bare", () => {
    expect(problemsIn(`export const f = (d: Date) => d.toLocaleDateString();`)).toHaveLength(1);
  });

  it("passes both when a locale is passed", () => {
    expect(problemsIn(`export const f = (l: string) => new Intl.NumberFormat(l);`)).toEqual([]);
    expect(problemsIn(`export const f = (d: Date, l: string) => d.toLocaleDateString(l);`)).toEqual(
      [],
    );
  });
});

describe("rule 6 — token discipline", () => {
  it("flags a raw Tailwind palette class", () => {
    const problems = problemsIn(`export const A = () => <p className="bg-red-500 p-4" />;`);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("bg-red-500");
  });

  it("flags a hex colour and a raw duration", () => {
    expect(problemsIn(`export const A = () => <p className="text-[#ff0000]" />;`)).toHaveLength(1);
    expect(problemsIn(`export const A = () => <p className="duration-300" />;`)).toHaveLength(1);
    expect(problemsIn(`export const A = () => <p className="transition-[200ms]" />;`)).toHaveLength(
      1,
    );
  });

  it("passes every semantic token the console is allowed to use", () => {
    // Named individually rather than as one string: this is the list from
    // apps/console/CLAUDE.md, and a rule that quietly started rejecting one of
    // them would be worse than one that misses a violation.
    for (const token of [
      "bg-canvas",
      "bg-paper",
      "bg-paperAlt",
      "border-line",
      "border-lineStrong",
      "text-ink",
      "text-inkSoft",
      "text-inkMute",
      "bg-brand",
      "text-brand",
      "rounded-card",
      "rounded-btn",
      "motion-safe:duration-[--motion-fast]",
    ]) {
      expect(problemsIn(`export const A = () => <p className="${token}" />;`), token).toEqual([]);
    }
  });

  it("looks inside a className built by a call, and inside its object keys", () => {
    expect(problemsIn(`export const A = () => <p className={cn("bg-red-500")} />;`)).toHaveLength(
      1,
    );
    expect(
      problemsIn(`export const A = () => <p className={cn({ "text-blue-700": true })} />;`),
    ).toHaveLength(1);
  });

  it("reads the literal halves of a template and ignores the interpolated one", () => {
    // The interpolation could be a semantic token chosen at runtime; the
    // literal halves could not.
    expect(
      problemsIn("export const A = ({ x }: { x: string }) => <p className={`${x} bg-red-500`} />;"),
    ).toHaveLength(1);
    expect(
      problemsIn("export const A = ({ x }: { x: string }) => <p className={`${x} text-ink`} />;"),
    ).toEqual([]);
  });
});

describe("suppression", () => {
  it("silences the line below the directive", () => {
    const source = [
      "export const A = () => (",
      "  // check-copy-ignore: the design gallery labels its own components",
      '  <p className="bg-red-500" />',
      ");",
    ].join("\n");

    expect(problemsIn(source)).toEqual([]);
    expect(countsIn(source).suppressions).toBe(1);
  });

  it("accepts the JSX comment form, which is the only one that works in children", () => {
    // `//` inside JSX children is not a comment — the parser keeps it as
    // literal text — so without this form suppression would be unusable for the
    // rule that matters most.
    const source = [
      "export const A = () => (",
      "  <p>",
      "    {/* check-copy-ignore: fixture text, not copy */}",
      "    Trace output",
      "  </p>",
      ");",
    ].join("\n");

    expect(problemsIn(source)).toEqual([]);
  });

  it("refuses a directive with no reason — and suppresses nothing with it", () => {
    const source = [
      "// check-copy-ignore:",
      'export const A = () => <p className="bg-red-500" />;',
    ].join("\n");
    const problems = problemsIn(source);

    // Two, and the second one is the point: a malformed directive is not a
    // half-working one. An exemption whose reason nobody wrote is an exemption
    // nobody can review, so the line below it stays checked.
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("probe.tsx:1:");
    expect(problems[0]).toContain("state why this line is exempt");
    expect(problems[1]).toContain("probe.tsx:2:");
    expect(problems[1]).toContain("bg-red-500");
  });

  it("does not silence a line two below it", () => {
    const source = [
      "// check-copy-ignore: applies to the next line only",
      "export const A = () => <p />;",
      'export const B = () => <p className="bg-red-500" />;',
    ].join("\n");

    expect(problemsIn(source)).toHaveLength(1);
  });
});

describe("a file with several violations", () => {
  it("reports every one of them, with its own line number", () => {
    const source = [
      "export const A = () => (",
      '  <div className="bg-red-500">',
      "    Hardcoded",
      '    <input placeholder="Type here" />',
      "  </div>",
      ");",
    ].join("\n");

    const problems = problemsIn(source);

    expect(problems).toHaveLength(3);
    expect(problems.some((p) => p.startsWith("probe.tsx:2:"))).toBe(true);
    expect(problems.some((p) => p.startsWith("probe.tsx:3:"))).toBe(true);
    expect(problems.some((p) => p.startsWith("probe.tsx:4:"))).toBe(true);
  });
});
