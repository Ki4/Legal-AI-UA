// The audit fixtures are held to the trigger that writes the real rows.
//
// `mocks.ts` says its audit rows are "shaped as the trigger writes them", and
// until 2026-09-18 nothing checked that. An order event carried
// `after: { status: "submitted" }` — the one field the timeline selects — and
// a later one carried `{}`, and the projection that read `after->>status` on
// every update passed its tests against a fixture that had already agreed with
// it. The bug was found by looking at the screen (#78). A fixture narrowed to
// what one reader selects cannot catch that reader selecting wrong.
//
// The rules below are the trigger's own, read off `audit_change` in the last
// migration that restates it rather than copied here: which tables it knows,
// which column it takes the entity id from, where the service id comes from,
// and which columns a trigger's arguments redact. `scripts/check-sql.mjs`
// already holds that the last restatement is the one that survives; this file
// holds that the fixtures agree with it. It cannot hold that `after` carries
// *every* column — nothing here knows a table's width without a database — so
// the claim is shape, not width: both sides of an update present and keyed
// alike, every changed column in them and different, the derivation keys
// present and matching. `{}` fails every one of those.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockAuditEvents, mockOrderEvents } from "./mocks";
import type { AuditEventRow } from "./types";

type Payload = Record<string, unknown>;

/** What one `when '<table>' then` arm of `audit_change` derives, and from where. */
interface EntityMapping {
  /** The `v_row` key the entity id is read from. */
  entityKey: string;
  /**
   * Where the service id comes from: a `v_row` key, `null` for a table that
   * has none, or `"derived"` for a lookup the fixture cannot reproduce (a
   * subquery, or `version_service()`).
   */
  service: string | null | "derived";
}

interface Trigger {
  /** Table → how the entity and service ids are derived from the row. */
  mappings: Map<string, EntityMapping>;
  /** Table → the columns its trigger's arguments strip from both payloads. */
  redacted: Map<string, string[]>;
}

const MIGRATIONS = new URL("../../../supabase/migrations/", import.meta.url);

/**
 * Reads the mapping off the last restatement of `audit_change`, the same way
 * `check-sql.mjs` finds it. The parse is narrow on purpose — the arms are
 * written one way in every restatement, and a shape the regex does not
 * recognise fails the `derives` assertion below rather than passing quietly.
 */
function readTrigger(): Trigger {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const mappings = new Map<string, EntityMapping>();
  const redacted = new Map<string, string[]>();
  let restatement: string | null = null;

  for (const file of files) {
    const sql = readFileSync(new URL(file, MIGRATIONS), "utf8");
    if (/create or replace function public\.audit_change\s*\(\)/.test(sql)) restatement = sql;

    // A trigger statement holds no semicolon of its own, so the terminator is a
    // safe fence (the reasoning is in check-sql.mjs, which learned it the hard
    // way). Arguments, when there are any, are the redacted column names.
    for (const match of sql.matchAll(/create trigger\s+\w+([\s\S]*?);/g)) {
      const statement = match[1] ?? "";
      const call = /execute function public\.audit_change\s*\(([^)]*)\)/.exec(statement);
      const on = /on public\.(\w+)/.exec(statement);
      if (call === null || on === null) continue;
      const columns = [...(call[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1] ?? "");
      if (columns.length > 0) redacted.set(on[1] ?? "", columns);
    }
  }

  if (restatement === null) return { mappings, redacted };

  const body = restatement.slice(restatement.indexOf("case tg_table_name"));
  for (const arm of body.matchAll(/when '(\w+)' then([\s\S]*?)(?=\n\s*when '|\n\s*else)/g)) {
    const table = arm[1] ?? "";
    const text = arm[2] ?? "";
    const entity = /v_entity := \(v_row ->> '(\w+)'\)::uuid/.exec(text);
    if (entity === null) continue;
    const entityKey = entity[1] ?? "";

    let service: EntityMapping["service"] = "derived";
    if (/v_service := v_entity;/.test(text)) service = entityKey;
    else if (/v_service := null;/.test(text)) service = null;
    else {
      const key = /v_service := \(v_row ->> '(\w+)'\)::uuid/.exec(text);
      if (key !== null) service = key[1] ?? "";
    }

    mappings.set(table, { entityKey, service });
  }

  return { mappings, redacted };
}

function isPayload(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Everything about one row the trigger could not have written. Empty for a row
 * it could.
 */
export function auditShapeProblems(row: AuditEventRow, trigger: Trigger): string[] {
  const problems: string[] = [];
  const { before, after, changed_columns: changed } = row;

  // 1. Which payloads exist is decided by `tg_op` and nothing else.
  if (row.action === "insert") {
    if (before !== null) problems.push("an insert has no `before`");
    if (!isPayload(after)) problems.push("an insert carries the new row in `after`");
    if (changed !== null) problems.push("an insert has no `changed_columns`");
  } else if (row.action === "delete") {
    if (after !== null) problems.push("a delete has no `after`");
    if (!isPayload(before)) problems.push("a delete carries the old row in `before`");
    if (changed !== null) problems.push("a delete has no `changed_columns`");
  } else {
    if (!isPayload(before)) problems.push("an update carries the old row in `before`");
    if (!isPayload(after)) problems.push("an update carries the new row in `after`");
    if (changed === null || changed.length === 0) {
      // The trigger returns before inserting when nothing changed.
      problems.push("an update names at least one changed column, or is not logged at all");
    }

    if (isPayload(before) && isPayload(after) && changed !== null && changed.length > 0) {
      // 2. Both sides are the same row: same columns, minus the same redaction.
      const beforeKeys = Object.keys(before).sort();
      const afterKeys = Object.keys(after).sort();
      if (!same(beforeKeys, afterKeys)) {
        problems.push(
          `\`before\` and \`after\` are the same row and carry the same keys ` +
            `(${beforeKeys.join(", ")} vs ${afterKeys.join(", ")})`,
        );
      }

      // 3. `array_agg(k order by k)`: sorted, and recorded before redaction — so
      // a changed column is in the payload unless the trigger stripped it.
      if (!same(changed, [...changed].sort())) {
        problems.push(`\`changed_columns\` is sorted (${changed.join(", ")})`);
      }
      const stripped = new Set(trigger.redacted.get(row.entity_table) ?? []);
      for (const column of changed) {
        if (stripped.has(column)) continue;
        if (!(column in after)) {
          problems.push(`changed column \`${column}\` is in \`after\``);
        } else if (same(before[column], after[column])) {
          problems.push(`changed column \`${column}\` differs between \`before\` and \`after\``);
        }
      }
      for (const column of afterKeys) {
        if (!changed.includes(column) && !same(before[column], after[column])) {
          problems.push(`\`${column}\` differs but is not in \`changed_columns\``);
        }
      }
    }
  }

  // 4. The entity and service ids are read off the row, so the row has the
  // keys they are read from and they agree. A table the trigger does not map is
  // one it raises for — `mocks.ts` carries one on purpose, standing for a
  // migration that mapped it before the console had a word for it, and that
  // case is by definition not checkable here.
  const payload = after ?? before;
  const mapping = trigger.mappings.get(row.entity_table);
  if (mapping !== undefined && isPayload(payload)) {
    if (payload[mapping.entityKey] !== row.entity_id) {
      problems.push(
        `\`entity_id\` is read from \`${mapping.entityKey}\`, which is ` +
          `${JSON.stringify(payload[mapping.entityKey])} here`,
      );
    }
    if (mapping.service === null && row.service_id !== null) {
      problems.push(`\`${row.entity_table}\` rows carry no \`service_id\``);
    } else if (typeof mapping.service === "string" && mapping.service !== "derived") {
      if (payload[mapping.service] !== row.service_id) {
        problems.push(
          `\`service_id\` is read from \`${mapping.service}\`, which is ` +
            `${JSON.stringify(payload[mapping.service])} here`,
        );
      }
    }
  }

  return problems;
}

const trigger = readTrigger();

const base: AuditEventRow = {
  id: 1,
  occurred_at: "2026-01-01T00:00:00.000Z",
  actor_id: null,
  actor_role: null,
  service_id: "svc-1",
  action: "update",
  entity_table: "services",
  entity_id: "svc-1",
  changed_columns: ["title"],
  before: { id: "svc-1", title: "Old" },
  after: { id: "svc-1", title: "New" },
};

describe("readTrigger", () => {
  // Without these, `auditShapeProblems` would check rules 1–3 and skip 4 for
  // every table, and the suite would be green for the wrong reason. The tables
  // named are the ones the fixtures use; a parse that finds nothing fails here
  // before it gets a chance to pass anything.
  it("derives the mapping the fixtures are checked against", () => {
    expect(trigger.mappings.get("services")).toEqual({ entityKey: "id", service: "id" });
    expect(trigger.mappings.get("service_versions")).toEqual({
      entityKey: "id",
      service: "service_id",
    });
    expect(trigger.mappings.get("service_version_prices")).toEqual({
      entityKey: "service_version_id",
      service: "derived",
    });
    expect(trigger.mappings.get("orders")).toEqual({ entityKey: "id", service: "derived" });
    expect(trigger.mappings.get("law_norms")).toEqual({ entityKey: "id", service: null });
  });

  it("reads the redacted columns off the trigger's arguments", () => {
    expect(trigger.redacted.get("client_identities")).toEqual(["full_name", "email", "phone"]);
    expect(trigger.redacted.has("services")).toBe(false);
  });
});

describe("auditShapeProblems", () => {
  it("accepts a row the trigger writes", () => {
    expect(auditShapeProblems(base, trigger)).toEqual([]);
  });

  // The row that hid #78, and the one a line away from it.
  it("rejects an update whose `after` is `{}`", () => {
    const problems = auditShapeProblems({ ...base, after: {} }, trigger);
    expect(problems).not.toEqual([]);
    expect(problems.join("\n")).toContain("changed column `title` is in `after`");
  });

  it("rejects an update with no `before`", () => {
    expect(auditShapeProblems({ ...base, before: null }, trigger)).toContain(
      "an update carries the old row in `before`",
    );
  });

  it("rejects payloads keyed unalike", () => {
    expect(
      auditShapeProblems({ ...base, after: { id: "svc-1", title: "New", slug: "x" } }, trigger),
    ).toContainEqual(expect.stringContaining("carry the same keys"));
  });

  it("rejects a changed column that did not change, and a change not named", () => {
    expect(
      auditShapeProblems({ ...base, after: { id: "svc-1", title: "Old" } }, trigger),
    ).toContain("changed column `title` differs between `before` and `after`");
    expect(
      auditShapeProblems(
        { ...base, changed_columns: ["title"], before: { id: "svc-0", title: "Old" } },
        trigger,
      ),
    ).toContain("`id` differs but is not in `changed_columns`");
  });

  it("lets a redacted column be named without being present", () => {
    const row: AuditEventRow = {
      ...base,
      entity_table: "client_identities",
      entity_id: "cli-1",
      service_id: null,
      changed_columns: ["email"],
      before: { client_id: "cli-1" },
      after: { client_id: "cli-1" },
    };
    expect(auditShapeProblems(row, trigger)).toEqual([]);
    expect(auditShapeProblems({ ...row, entity_table: "services" }, trigger)).not.toEqual([]);
  });

  it("rejects an insert with a `before`, and one without an `after`", () => {
    const insert: AuditEventRow = {
      ...base,
      action: "insert",
      changed_columns: null,
      before: null,
    };
    expect(auditShapeProblems(insert, trigger)).toEqual([]);
    expect(auditShapeProblems({ ...insert, before: {} }, trigger)).toContain(
      "an insert has no `before`",
    );
    expect(auditShapeProblems({ ...insert, after: null }, trigger)).toContain(
      "an insert carries the new row in `after`",
    );
  });

  it("holds the entity and service ids to the keys the trigger reads them from", () => {
    expect(auditShapeProblems({ ...base, entity_id: "svc-2" }, trigger)).toContainEqual(
      expect.stringContaining("`entity_id` is read from `id`"),
    );
    expect(auditShapeProblems({ ...base, service_id: "svc-2" }, trigger)).toContainEqual(
      expect.stringContaining("`service_id` is read from `id`"),
    );
    // A derived service id is not the row's to disagree with.
    expect(
      auditShapeProblems(
        {
          ...base,
          entity_table: "orders",
          entity_id: "ord-1",
          service_id: "svc-anything",
          before: { id: "ord-1", title: "Old" },
          after: { id: "ord-1", title: "New" },
        },
        trigger,
      ),
    ).toEqual([]);
  });

  it("skips derivation for a table the trigger has no arm for", () => {
    expect(
      auditShapeProblems({ ...base, entity_table: "not_a_table", entity_id: "whatever" }, trigger),
    ).toEqual([]);
  });
});

describe("the fixtures", () => {
  for (const [name, rows] of [
    ["mockAuditEvents", mockAuditEvents],
    ["mockOrderEvents", mockOrderEvents],
  ] as const) {
    it(`${name} carries only rows the trigger could have written`, () => {
      const report = rows
        .map((row) => ({ id: row.id, problems: auditShapeProblems(row, trigger) }))
        .filter((entry) => entry.problems.length > 0);
      expect(report).toEqual([]);
    });
  }
});
