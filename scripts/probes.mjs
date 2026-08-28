// The probes: for each one, a one-line change to real source that a named test
// must catch — and the assertion that it does.
//
// A green suite says the code passes its tests. It does not say the tests can
// fail, and those are different claims: a test asserting `expect(true).toBe(true)`
// inside a describe block about RLS is green forever and protects nothing. The
// habit in this repository has been to break something deliberately, watch the
// right test go red, put it back, and write a sentence about it in the PR
// description. That works exactly once. Nothing re-runs it, so the day an
// assertion quietly stops reaching the thing it names, the PR sentence is still
// there and still says it was checked.
//
// This file is that sentence made executable. `pnpm probes` applies each patch
// to the real file, runs the one test that should notice, and fails if the test
// passes anyway.
//
// **A probe is a claim about a specific assertion, not about coverage.** Each
// one names the behaviour it removes and the test that must object. When a probe
// stops finding its `from` text, that is a failure too — the code moved and
// nobody asked whether the assertion moved with it.

export const PROBES = [
  {
    id: "checkbox-description-in-name",
    what: "folds a Checkbox's description into its accessible name",
    file: "packages/ui/src/components/Checkbox.tsx",
    test: "packages/ui/src/components/Checkbox.test.tsx",
    from: `        <span className={cn("min-w-0 text-sm text-ink", disabled && "opacity-50")}>{label}</span>
      </label>`,
    to: `        <span className={cn("min-w-0 text-sm text-ink", disabled && "opacity-50")}>{label}</span>
        <span>{description}</span>
      </label>`,
  },
  {
    id: "useconfirm-strands-promise-on-unmount",
    what: "lets a pending confirmation go unanswered when the screen unmounts",
    file: "packages/ui/src/components/ConfirmModal.tsx",
    test: "packages/ui/src/components/ConfirmModal.test.tsx",
    from: `      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);`,
    to: `      resolveRef.current = null;
    };
  }, []);`,
  },
  {
    id: "dialog-ignores-browser-close",
    what: "stops listening for a close the browser performed (Esc)",
    file: "packages/ui/src/components/Dialog.tsx",
    test: "packages/ui/src/components/Dialog.test.tsx",
    from: `    el.addEventListener("close", handleClose);`,
    to: `    void handleClose;`,
  },
  {
    id: "fields-empty-and-error-share-a-sentence",
    what: "makes a failed load say the questionnaire is empty",
    file: "apps/console/src/features/service-fields/components/ServiceFieldsPage.tsx",
    test: "apps/console/src/features/service-fields/components/ServiceFieldsPage.test.tsx",
    // Written against the formatted source, not against how it was typed:
    // Prettier wrapped this call the moment it was committed, and the probe's
    // first run reported itself rotted. Working as intended, and worth leaving
    // in the record — the alternative is a probe that quietly matches nothing.
    from: `            title={t("serviceFields.failed.title")}
            hint={t("serviceFields.failed.hint")}`,
    to: `            title={t("serviceFields.empty.title")}
            hint={t("serviceFields.empty.hint")}`,
  },
  {
    id: "team-empty-and-error-share-a-sentence",
    what: "makes a failed load say the team is empty",
    file: "apps/console/src/features/team/components/TeamPage.tsx",
    test: "apps/console/src/features/team/components/TeamPage.test.tsx",
    from: `<EmptyState title={t("team.failed.title")} hint={t("team.failed.hint")} />`,
    to: `<EmptyState title={t("team.empty.title")} hint={t("team.empty.hint")} />`,
  },
  {
    id: "retention-empty-box-reads-as-zero",
    what: "stops telling an unanswered retention period from an answered zero",
    file: "apps/console/src/features/service-fields/api/draft.ts",
    test: "apps/console/src/features/service-fields/api/draft.test.ts",
    from: `  if (draft.retentionDays.trim() === "") rejections.push("missing_retention");`,
    to: `  if (false) rejections.push("missing_retention");`,
  },
  {
    id: "move-past-the-end-is-silent",
    what: "turns a refused reorder into a silent no-op",
    file: "apps/console/src/features/service-fields/api/service-fields.mock.ts",
    test: "apps/console/src/features/service-fields/api/service-fields.mock.test.ts",
    from: `      throw new AppError("validation", "That field is already at the end of the list.");`,
    to: `      return siblings.map(toField);`,
  },
  {
    id: "contrast-floor-relaxed",
    what: "relaxes the contrast floor from AA-normal to AA-large",
    file: "scripts/check-contrast.mjs",
    test: "scripts/check-contrast.test.mjs",
    from: `export const AA_NORMAL = 4.5;`,
    to: `export const AA_NORMAL = 3;`,
  },
  {
    id: "sql-block-handback-unchecked",
    what: "stops requiring a verification block to hand the session back",
    file: "scripts/check-sql.mjs",
    test: "scripts/check-sql.test.mjs",
    from: `    if (!resetsRole || !resetsClaims) {`,
    to: `    if (false) {`,
  },
  {
    id: "docs-budget-skips-a-missing-file",
    what: "lets a missing tier-1 document pass the budget instead of failing it",
    file: "scripts/check-docs-lib.mjs",
    test: "scripts/check-docs.test.mjs",
    from: `    if (text === undefined) {
      problems.push(`,
    to: `    if (false) {
      problems.push(`,
  },
  {
    id: "job-status-enum-drifts-from-its-bridge",
    what: "adds a status to the schema that the TypeScript union has never heard of",
    file: "packages/core-client/schema/job.schema.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `      "enum": ["queued", "running", "succeeded", "failed"]`,
    to: `      "enum": ["queued", "running", "succeeded", "failed", "cancelled"]`,
  },
  {
    id: "job-status-bridge-drifts-from-the-schema",
    what: "adds a status to the TypeScript union that the schema has never heard of",
    file: "packages/core-client/src/protocol.ts",
    test: "packages/core-client/src/protocol.test.ts",
    from: `export const JOB_STATUS = ["queued", "running", "succeeded", "failed"] as const;`,
    to: `export const JOB_STATUS = ["queued", "running", "succeeded", "failed", "cancelled"] as const;`,
  },
  {
    id: "job-key-bridge-loses-a-property",
    what: "drops a property from the key bridge the schema still lists",
    file: "packages/core-client/src/protocol.ts",
    test: "packages/core-client/src/protocol.test.ts",
    from: `  "finished_at",`,
    to: ``,
  },
  {
    id: "envelope-names-an-operation-the-client-does-not",
    what: "renames an operation in operations.json without touching CoreClient",
    file: "packages/core-client/schema/operations.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `    "getGenerationJob": {`,
    to: `    "pollGenerationJob": {`,
  },
  {
    id: "envelope-ref-rots",
    what: "points an operation at a schema file that is not there",
    file: "packages/core-client/schema/operations.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `"$ref": "https://legal-ai.ua/schema/generation-request.schema.json"`,
    to: `"$ref": "https://legal-ai.ua/schema/generation-req.schema.json"`,
  },
  {
    id: "generation-waits-for-its-own-result",
    what: "answers the submission with 200, which is the synchronous call ADR-0022 ruled out",
    file: "packages/core-client/schema/operations.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `        "status": 202,`,
    to: `        "status": 200,`,
  },
  {
    id: "error-code-with-no-home",
    what: "leaves a code that is neither an HTTP answer nor something a job carries",
    file: "packages/core-client/schema/operations.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `  "job_error_codes": ["generation_failed"],`,
    to: `  "job_error_codes": [],`,
  },
  {
    id: "succeeded-job-without-its-result",
    what: "lets a job say it succeeded and carry nothing — the invariant the flat shape moved into a test",
    file: "packages/core-client/fixtures/protocol.valid.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `      "result": {
        "$fixture": "trace.valid.json"
      },`,
    to: `      "result": null,`,
  },
  {
    id: "constraint-added-with-no-failing-case",
    what: "adds a constraint to the schema that no negative fixture exercises",
    file: "packages/core-client/schema/job.schema.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `      "type": "string",
      "minLength": 1
    },
    "status": { "$ref": "#/$defs/JobStatus" },`,
    to: `      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "status": { "$ref": "#/$defs/JobStatus" },`,
  },
  {
    id: "job-status-no-fixture-reaches",
    what: "leaves a status in the contract that no fixture exercises",
    file: "packages/core-client/fixtures/protocol.valid.json",
    test: "packages/core-client/src/protocol.test.ts",
    from: `      "status": "running",`,
    to: `      "status": "queued",`,
  },
  {
    id: "runtime-trace-drifts-from-the-file",
    what: "changes the shipped trace without changing the fixture ajv validates",
    file: "packages/core-client/src/fixture-trace.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `      title: "Legal grounds",`,
    to: `      title: "Legal basis",`,
  },
  {
    id: "terminal-job-takes-another-step",
    what: "lets a finished job move again on the next poll",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `      if (job.status === "queued") {`,
    to: `      if (job.status === "queued" || job.status === "succeeded") {`,
  },
  {
    id: "fixture-client-hands-out-its-own-state",
    what: "returns the stored job, so a caller that edits it edits the fixture",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `      // A poll after the end is not another step. Nothing above moves a terminal
      // job, so this returns what the previous poll returned.
      return copyOf(job);`,
    to: `      return job;`,
  },
  {
    id: "fixture-throws-an-undeclared-code",
    what: "refuses a poll with a code operations.json does not declare for it",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `throw new CoreCallError({ code: "not_found", message: \`No job \${jobId}.\` });`,
    to: `throw new CoreCallError({ code: "invalid_request", message: \`No job \${jobId}.\` });`,
  },
  {
    id: "fixture-timestamps-come-from-the-wall-clock",
    what: "reads the clock instead of the fixed epoch, so no two runs agree",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `const EPOCH = Date.parse("2026-08-28T08:00:00.000Z");`,
    to: `const EPOCH = Date.now();`,
  },
  {
    id: "failed-job-carries-a-result-too",
    what: "puts a trace on a failed job, which the invariants forbid",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `          job.status = "failed";`,
    to: `          job.status = "failed";
          job.result = fixtureTrace;`,
  },
];
