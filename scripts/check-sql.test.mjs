// The SQL checker, asserted rule by rule and in both halves.
//
// The second of the two checkers that had no tests until 2026-08-27, which was
// the defect they were written to catch, one level up: a gate nothing executes
// is a comment. `check-sql.mjs` gained an exported core the same day, for the
// same reason — it could not be called on a tree that was deliberately wrong.
//
// Every case builds a throwaway `supabase/` rather than asserting against the
// real one. The real tree is supposed to be clean, so it can only ever exercise
// the passing half — and a test that only knows how to pass cannot tell a
// working checker from a deleted one.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkSql } from "./check-sql.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

/** A block that satisfies rule 2, so a fixture testing rule 1 fails only rule 1. */
const GOOD_BLOCK = `do $$
begin
  set local role postgres;
  raise notice 'PASS 1. something';
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
`;

function tree({ migrations = [], ledger, snippets = {}, bodies = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "sql-check-"));
  roots.push(root);

  const files = {
    "supabase/snippets/repair_migration_ledger.sql":
      ledger ??
      `insert into supabase_migrations.schema_migrations (version, name) values\n${migrations
        .map((file) => {
          const [, version, name] = /^(\d{14})_(.+)\.sql$/.exec(file) ?? [];
          return `  ('${version}', '${name}')`;
        })
        .join(",\n")};\n`,
    ...Object.fromEntries(
      Object.entries(snippets).map(([name, body]) => [`supabase/snippets/${name}`, body]),
    ),
    ...Object.fromEntries(
      migrations.map((file) => [`supabase/migrations/${file}`, bodies[file] ?? "select 1;\n"]),
    ),
  };

  mkdirSync(join(root, "supabase/migrations"), { recursive: true });
  mkdirSync(join(root, "supabase/snippets"), { recursive: true });

  for (const [name, text] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  }

  return root;
}

const problems = (options) => checkSql(tree(options)).problems;
const matching = (list, needle) => list.filter((entry) => entry.includes(needle));

describe("1. the ledger lists exactly the migrations that exist", () => {
  const MIGRATIONS = ["20260101120000_first.sql", "20260102120000_second.sql"];

  it("passes when the two agree", () => {
    expect(problems({ migrations: MIGRATIONS })).toEqual([]);
  });

  it("fails a migration the ledger does not list", () => {
    // The original failure: seven listed, eight shipped. A ledger repaired from
    // that script declares itself complete while `db push` skips a file.
    const ledger = `insert into x values\n  ('20260101120000', 'first');\n`;
    const found = matching(problems({ migrations: MIGRATIONS, ledger }), "does not list");

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("20260102120000_second.sql");
  });

  it("fails a ledger entry no file matches", () => {
    // The worse half: recording a migration that was never applied.
    const ledger = `insert into x values\n  ('20260101120000', 'first'),\n  ('20260909120000', 'ghost');\n`;
    expect(matching(problems({ migrations: MIGRATIONS, ledger }), "which no file")).toHaveLength(1);
  });

  it("fails a name the ledger and the file disagree about", () => {
    const ledger = `insert into x values\n  ('20260101120000', 'renamed'),\n  ('20260102120000', 'second');\n`;
    const found = matching(problems({ migrations: MIGRATIONS, ledger }), "the file calls it");

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("renamed");
  });

  it("fails a migration filename that is not <timestamp>_<name>.sql", () => {
    expect(matching(problems({ migrations: ["add_column.sql"] }), "not <timestamp>")).toHaveLength(
      1,
    );
  });
});

describe("2. every verification block declares and hands back an identity", () => {
  it("passes a block that does both", () => {
    expect(problems({ snippets: { "verify_thing.sql": GOOD_BLOCK } })).toEqual([]);
  });

  it("fails a block that declares no identity, and passes it once it does", () => {
    // The real defect: `set local` lasts for the transaction, so a block that
    // declares nothing runs as whoever the previous block left behind. One
    // scenario was green only because its predecessor had left a conveniently
    // assigned lawyer in the session.
    const silent = `do $$\nbegin\n  raise notice 'PASS';\n  reset role;\n  perform set_config('request.jwt.claims', '', true);\nend $$;\n`;

    expect(
      matching(
        problems({ snippets: { "verify_thing.sql": silent } }),
        "whoever the previous block",
      ),
    ).toHaveLength(1);
    expect(
      matching(
        problems({ snippets: { "verify_thing.sql": GOOD_BLOCK } }),
        "whoever the previous block",
      ),
    ).toHaveLength(0);
  });

  it("accepts claims alone as a declaration, not only a role", () => {
    const claimsOnly = `do $$\nbegin\n  set local request.jwt.claims = '{"sub":"x"}';\n  reset role;\n  perform set_config('request.jwt.claims', '', true);\nend $$;\n`;

    expect(
      matching(problems({ snippets: { "verify_thing.sql": claimsOnly } }), "whoever the previous"),
    ).toHaveLength(0);
  });

  it("fails a block that resets the role but keeps the claims, and vice versa", () => {
    // Both halves of the handback are required, and each on its own leaves the
    // next block borrowing half an identity — which is the shape that passes for
    // the wrong reason rather than failing.
    const roleOnly = `do $$\nbegin\n  set local role postgres;\n  reset role;\nend $$;\n`;
    const claimsOnly = `do $$\nbegin\n  set local role postgres;\n  perform set_config('request.jwt.claims', '', true);\nend $$;\n`;

    expect(
      matching(problems({ snippets: { "verify_a.sql": roleOnly } }), "hand the session back"),
    ).toHaveLength(1);
    expect(
      matching(problems({ snippets: { "verify_b.sql": claimsOnly } }), "hand the session back"),
    ).toHaveLength(1);
  });

  it("names the block by its number, so a long file can be navigated", () => {
    const bad = `do $$\nbegin\n  raise notice 'x';\nend $$;\n`;
    const found = matching(
      problems({ snippets: { "verify_thing.sql": GOOD_BLOCK + bad } }),
      "block 2",
    );

    expect(found.length).toBeGreaterThan(0);
  });

  it("fails a verify_ file holding no blocks at all", () => {
    expect(
      matching(problems({ snippets: { "verify_empty.sql": "select 1;\n" } }), "no do $$ blocks"),
    ).toHaveLength(1);
  });

  it("looks only at verify_ files", () => {
    // `repair_migration_ledger.sql` is a snippet and not a verification script;
    // holding it to rule 2 would produce a permanent failure nobody can fix.
    expect(
      problems({ snippets: { "helper.sql": "do $$ begin raise notice 'x'; end $$;\n" } }),
    ).toEqual([]);
  });
});

describe("what it counts", () => {
  it("reports the blocks it inspected, so a file silently dropping out is visible", () => {
    const result = checkSql(
      tree({ snippets: { "verify_a.sql": GOOD_BLOCK, "verify_b.sql": GOOD_BLOCK + GOOD_BLOCK } }),
    );

    expect(result.blockCount).toBe(3);
    expect(result.problems).toEqual([]);
  });
});

describe("3. the surviving audit_change knows every audited table", () => {
  const FIRST = "20260101120000_blocks.sql";
  const SECOND = "20260102120000_signals.sql";

  /** A restatement of the function mapping exactly the tables named. */
  function declares(tables) {
    const arms = tables.map((table) => `    when '${table}' then\n      v_entity := null;`);
    return [
      "create or replace function public.audit_change ()",
      "returns trigger as $fn$",
      "begin",
      "  case tg_table_name",
      ...arms,
      "    else",
      "      raise exception 'no mapping';",
      "  end case;",
      "end;",
      "$fn$;",
      "",
    ].join("\n");
  }

  function auditTrigger(table) {
    return [
      `create trigger ${table}_audit`,
      `after insert or update or delete on public.${table}`,
      "for each row execute function public.audit_change ();",
      "",
    ].join("\n");
  }

  it("passes when the last restatement still maps everything audited", () => {
    const bodies = {
      [FIRST]: declares(["blocks"]) + auditTrigger("blocks"),
      [SECOND]: declares(["blocks", "signals"]) + auditTrigger("signals"),
    };

    expect(problems({ migrations: [FIRST, SECOND], bodies })).toEqual([]);
  });

  // The failure this rule exists for, in miniature. Only the last
  // `create or replace` survives, so a copy taken before `blocks` was added
  // removes it — and the diff that did it looks like a function being added
  // rather than a branch being dropped.
  it("fails a restatement that dropped a mapping an earlier migration added", () => {
    const bodies = {
      [FIRST]: declares(["blocks"]) + auditTrigger("blocks"),
      [SECOND]: declares(["signals"]) + auditTrigger("signals"),
    };

    const found = matching(problems({ migrations: [FIRST, SECOND], bodies }), "no mapping for");

    expect(found).toHaveLength(1);
    expect(found[0]).toContain("blocks");
    expect(found[0]).toContain(SECOND);
  });

  // The bug this checker itself shipped with, kept as a case: a pattern reaching
  // from `create trigger` to the next `audit_change` anywhere in the file walks
  // through unrelated triggers and blames whichever table the first one named.
  it("does not mistake a neighbouring trigger for an audited table", () => {
    const decoy = [
      "create trigger blocks_touch",
      "before update on public.timestamps_only",
      "for each row execute function public.touch_updated_at ();",
      "",
    ].join("\n");

    const bodies = { [FIRST]: declares(["blocks"]) + decoy + auditTrigger("blocks") };

    expect(problems({ migrations: [FIRST], bodies })).toEqual([]);
  });

  it("counts the audited tables it found, so a silent drop-out is visible", () => {
    const bodies = {
      [FIRST]: declares(["blocks", "signals"]) + auditTrigger("blocks") + auditTrigger("signals"),
    };

    expect(checkSql(tree({ migrations: [FIRST], bodies })).auditedTableCount).toBe(2);
  });

  it("says so when tables are audited and nothing defines the function", () => {
    const bodies = { [FIRST]: auditTrigger("blocks") };
    const found = matching(problems({ migrations: [FIRST], bodies }), "no migration defines");

    expect(found).toHaveLength(1);
  });
});
