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

  // The last three of the cases this package ran by hand. Two of them are
  // watched by `tsc` rather than Vitest (the `typecheck` field): the bridges
  // they break are types, and a type assertion is transpiled away before a test
  // ever runs, so Vitest would stay green and the probe would report a defect
  // that is not there. The third was called inexpressible because its patch has
  // to make one store outlive the function that owns it; it does, through
  // `globalThis`, which is one text replacement and needs no new declaration.
  {
    id: "job-interface-grows-a-key-its-bridge-misses",
    what: "adds a property to `Job` that `JOB_KEYS` does not list",
    file: "packages/core-client/src/protocol.ts",
    typecheck: "@legal-ai/core-client",
    test: "JobKeysAreExhaustive",
    from: `  /** Why it failed, present exactly when \`status\` is \`failed\`. */
  error: CoreError | null;
}`,
    to: `  /** Why it failed, present exactly when \`status\` is \`failed\`. */
  error: CoreError | null;
  retries: number;
}`,
  },
  {
    id: "core-client-grows-a-method-operations-does-not-know",
    what: "adds a method to `CoreClient` that `CORE_OPERATIONS` does not list",
    file: "packages/core-client/src/protocol.ts",
    typecheck: "@legal-ai/core-client",
    test: "CoreOperationsAreExhaustive",
    from: `  /** The job as it stands. Returns, rather than throws, on a failed job. */
  getGenerationJob(jobId: string): Promise<Job>;
}`,
    to: `  /** The job as it stands. Returns, rather than throws, on a failed job. */
  getGenerationJob(jobId: string): Promise<Job>;
  cancelGenerationJob(jobId: string): Promise<Job>;
}`,
  },
  {
    id: "two-fixture-clients-share-one-store",
    what: "gives every fixture client the same job map, so two screens see each other's work",
    file: "packages/core-client/src/fixture-client.ts",
    test: "packages/core-client/src/fixture-client.test.ts",
    from: `  const jobs = new Map<string, Job>();`,
    to: `  const jobs = ((globalThis as { __probeJobs?: Map<string, Job> }).__probeJobs ??= new Map<
    string,
    Job
  >());`,
  },

  // The twenty-nine cases run by hand against the trace schema and the anatomy
  // mapper on 2026-08-27, and carried as a debt ever since. They were real work
  // and every one of them went red; what none of them was, was repeatable.
  //
  // **These probes name a test file, and several assertions share one.** A probe
  // here proves `schema.test.ts` notices — not which `it` inside it did. That is
  // weaker than the one-probe-one-assertion claim this file opens with, and it
  // is the granularity Vitest offers at a path. Where a case could be aimed at a
  // single assertion it was; where two assertions both catch a patch, `what`
  // says which one it was written for.
  {
    id: "trace-block-left-open",
    what: "lets a block carry a property the contract has never heard of",
    file: "packages/core-client/schema/trace.schema.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `    "TraceBlock": {
      "description": "One block of the generated document, and the account of what produced it.",
      "type": "object",
      "additionalProperties": false,`,
    to: `    "TraceBlock": {
      "description": "One block of the generated document, and the account of what produced it.",
      "type": "object",
      "additionalProperties": true,`,
  },
  {
    id: "block-trust-enum-drifts-from-its-bridge",
    what: "adds a trust value to the schema that BLOCK_TRUST does not carry",
    file: "packages/core-client/schema/trace.schema.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "enum": ["template", "ai_generated", "lawyer_edited"]`,
    to: `      "enum": ["template", "ai_generated", "lawyer_edited", "core_reviewed"]`,
  },
  {
    id: "trace-def-nothing-exercises",
    what: "adds a $def no fixture reaches, which must fail rather than pass quietly",
    file: "packages/core-client/schema/trace.schema.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `    "LawSource": {`,
    to: `    "Unused": {
      "description": "A type nothing reaches.",
      "type": "string"
    },
    "LawSource": {`,
  },
  {
    id: "trace-constraint-with-no-failing-case",
    what: "adds a constraint no invalid fixture has watched the schema enforce",
    file: "packages/core-client/schema/trace.schema.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `          "type": "string",
          "minLength": 1
        },
        "article": {`,
    to: `          "type": "string",
          "minLength": 1,
          "maxLength": 200
        },
        "article": {`,
  },
  {
    id: "instant-accepts-an-offset-again",
    what: "relaxes the Instant pattern to accept +03:00, the acceptance ADR-0021 section 3 rejected format: date-time over",
    file: "packages/core-client/schema/trace.schema.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `(\\\\.\\\\d{3})?Z$"`,
    to: `(\\\\.\\\\d{3})?(Z|[+-]\\\\d{2}:\\\\d{2})$"`,
  },
  {
    id: "trace-key-bridge-loses-a-property",
    what: "drops a key from GENERATION_TRACE_KEYS while the schema still requires it",
    file: "packages/core-client/src/trace.ts",
    test: "packages/core-client/src/schema.test.ts",
    from: `export const GENERATION_TRACE_KEYS = [
  "trace_version",
  "service_id",
  "law_refs",
  "blocks",
]`,
    to: `export const GENERATION_TRACE_KEYS = [
  "trace_version",
  "service_id",
  "law_refs",
]`,
  },
  {
    id: "law-source-bridge-gains-a-value",
    what: "adds a source to LAW_SOURCE that the schema enum does not list",
    file: "packages/core-client/src/trace.ts",
    test: "packages/core-client/src/schema.test.ts",
    from: `export const LAW_SOURCE = ["zakon_rada"] as const;`,
    to: `export const LAW_SOURCE = ["zakon_rada", "opendatabot"] as const;`,
  },
  {
    id: "constraint-keywords-counted-by-inclusion",
    what: "counts constraints against a written list again, so a keyword nobody thought of goes unwatched",
    file: "packages/core-client/src/schema-walk.ts",
    test: "packages/core-client/src/schema.test.ts",
    from: `      constrained.add(key);`,
    to: `      if (["enum", "const", "type", "required", "minLength"].includes(key)) constrained.add(key);`,
  },
  {
    id: "trust-value-no-fixture-reaches",
    what: "leaves the template trust value carried by no fixture block",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "trust": "template",`,
    to: `      "trust": "ai_generated",`,
  },
  {
    id: "tool-outcome-no-fixture-reaches",
    what: "makes every fixture tool call succeed, so the error outcome is never exercised",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `          "outcome": "error"`,
    to: `          "outcome": "ok"`,
  },
  {
    id: "act-scope-never-exercised",
    what: "gives every law ref an article, so null — which is how the contract says the whole act — is never sent",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "article": null,`,
    to: `      "article": "3",`,
  },
  {
    id: "verified-at-never-null",
    what: "verifies every law ref, so the never-verified branch has no fixture",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "verified_at": null`,
    to: `      "verified_at": "2026-08-20T06:15:00Z"`,
  },
  {
    id: "law-ref-ids-never-empty",
    what: "cites a norm in every block, so an empty citation list is never proven legal",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "law_ref_ids": [],`,
    to: `      "law_ref_ids": ["norm-family-105"],`,
  },
  {
    id: "questionnaire-fields-never-empty",
    what: "gives every block a questionnaire field, so the empty array is never sent",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "questionnaire_fields": [],`,
    to: `      "questionnaire_fields": ["children"],`,
  },
  {
    id: "block-cites-a-norm-the-register-lacks",
    what: "cites an id the trace does not carry, which the schema cannot see and the screen renders as a hole",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "law_ref_ids": ["norm-family-112", "norm-family-105"],`,
    to: `      "law_ref_ids": ["norm-family-112", "norm-family-999"],`,
  },
  {
    id: "register-carries-a-norm-nobody-cites",
    what: "leaves a law ref in the register that no block cites, which renders nowhere",
    file: "packages/core-client/fixtures/trace.valid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "law_ref_ids": ["norm-family-112", "norm-family-105"],
      "questionnaire_fields": [],`,
    to: `      "law_ref_ids": ["norm-family-112"],
      "questionnaire_fields": [],`,
  },
  {
    id: "invalid-case-stops-covering-its-constraint",
    what: "retags the one case aimed at const, leaving that constraint with nothing watching it",
    file: "packages/core-client/fixtures/trace.invalid.json",
    test: "packages/core-client/src/schema.test.ts",
    from: `      "constraint": "const",`,
    to: `      "constraint": "type",`,
  },
  {
    id: "anatomy-mapper-stops-renaming-a-field",
    what: "reads nothing for needsAttention, so the snake_case source is not the one being renamed",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    needsAttention: block.needs_attention,`,
    to: `    needsAttention: false,`,
  },
  {
    id: "anatomy-view-carries-the-wire-shape-through",
    what: "spreads the wire block into the view, so snake_case keys reach the component",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    id: block.id,`,
    to: `    ...block,
    id: block.id,`,
  },
  {
    id: "anatomy-view-hands-out-the-source-array",
    what: "returns the fixture's own array, so a component sorting it rewrites the source",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    questionnaireFields: [...block.questionnaire_fields],`,
    to: `    questionnaireFields: block.questionnaire_fields,`,
  },
  {
    id: "anatomy-reorders-a-blocks-citations",
    what: "sorts a block's citations, losing the order the core cited them in",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    lawRefs: block.law_ref_ids.map((normId) => {`,
    to: `    lawRefs: [...block.law_ref_ids].sort().map((normId) => {`,
  },
  {
    id: "anatomy-renders-a-dangling-id-as-nothing",
    what: "renders an unresolved citation with an empty title instead of the id itself",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `  return { normId, actTitle: normId, article: null };`,
    to: `  return { normId, actTitle: "", article: null };`,
  },
  {
    id: "anatomy-getTrace-hands-out-one-shared-view",
    what: "returns one view object to every caller, so one caller's edit reaches the next",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    return toTraceView(fixtureTrace);`,
    to: `    return ((globalThis as { __probeView?: GenerationTraceView }).__probeView ??=
      toTraceView(fixtureTrace));`,
  },
  {
    id: "anatomy-trust-falls-back-to-english",
    what: "drops the label, so a lawyer reads the design system's English default",
    file: "apps/console/src/features/anatomy/components/AnatomyPage.tsx",
    test: "apps/console/src/features/anatomy/components/AnatomyPage.test.tsx",
    from: `                  <Provenance
                    state={trustBadge[block.trust].state}
                    label={t(trustBadge[block.trust].key)}
                  />`,
    to: `                  <Provenance state={trustBadge[block.trust].state} />`,
  },
  {
    id: "anatomy-failure-renders-as-empty",
    what: "swallows the failure, so a document nobody may see reads as one nobody generated",
    file: "apps/console/src/features/anatomy/hooks/useTrace.ts",
    test: "apps/console/src/features/anatomy/components/AnatomyPage.test.tsx",
    from: `        setErrorKey(messageKeyFor(error));
        setTrace(null);`,
    to: `        setTrace(null);`,
  },
  {
    id: "anatomy-failure-loses-its-code",
    what: "reads a refused read as a generic fault, losing the one sentence that says why",
    file: "apps/console/src/features/anatomy/hooks/useTrace.ts",
    test: "apps/console/src/features/anatomy/components/AnatomyPage.test.tsx",
    from: `      case "forbidden":
        return "anatomy.error.forbidden";`,
    to: `      case "forbidden":
        return "anatomy.error.unknown";`,
  },
  {
    id: "anatomy-tool-calls-hide-the-failure",
    what: "keeps only the calls that succeeded, so a retried failure never reaches the screen",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `    toolCalls: block.tool_calls.map(toToolCallView),`,
    to: `    toolCalls: block.tool_calls.filter((c) => c.outcome === "ok").map(toToolCallView),`,
  },
  {
    id: "anatomy-tool-call-carries-the-clock-through",
    what: "spreads the wire call into the view, so started_at rides along as an excess property",
    file: "apps/console/src/features/anatomy/api/anatomy.mock.ts",
    test: "apps/console/src/features/anatomy/api/anatomy.mock.test.ts",
    from: `  return { tool: call.tool, outcome: call.outcome };`,
    to: `  return { ...call };`,
  },
  {
    id: "anatomy-unconditional-block-says-nothing",
    what: "renders nothing for a block no condition selected, so absence and silence look alike",
    file: "apps/console/src/features/anatomy/components/AnatomyPage.tsx",
    test: "apps/console/src/features/anatomy/components/AnatomyPage.test.tsx",
    from: `                {block.selectedBy === null
                  ? t("anatomy.selectedBy.unconditional")
                  : t("anatomy.selectedBy", { expression: block.selectedBy.expression })}`,
    to: `                {block.selectedBy === null
                  ? null
                  : t("anatomy.selectedBy", { expression: block.selectedBy.expression })}`,
  },
  {
    id: "article-text-plausibility-floor-removed",
    what: "drops the floor under an extraction, so empty markup passes as an article and a broken parser reads as a quiet week (§9.15)",
    file: "packages/law-refs/src/text.ts",
    test: "packages/law-refs/src/text.test.ts",
    from: `export const MIN_PLAUSIBLE_ARTICLE_LENGTH = 12;`,
    to: `export const MIN_PLAUSIBLE_ARTICLE_LENGTH = 0;`,
  },
  {
    id: "article-text-skips-unicode-composition",
    what: "stops composing unicode, so one letter written two ways fingerprints apart and the norm drifts on a difference nobody can see",
    file: "packages/law-refs/src/text.ts",
    test: "packages/law-refs/src/text.test.ts",
    from: `    .normalize("NFC")
    .replace(INVISIBLE, "")`,
    to: `    .replace(INVISIBLE, "")`,
  },
  {
    id: "fingerprint-stops-naming-its-algorithm",
    what: "drops the algorithm from a stored fingerprint, so changing the digest later is silent rather than readable",
    file: "packages/law-refs/src/text.ts",
    test: "packages/law-refs/src/text.test.ts",
    from: `const DIGEST_PREFIX = "sha256:";`,
    to: `const DIGEST_PREFIX = "";`,
  },
  {
    id: "line-break-misses-the-unicode-separators",
    what: "handles only CRLF, so U+2028 rides into the stored text and leaves the line around it untrimmed",
    file: "packages/law-refs/src/text.ts",
    test: "packages/law-refs/src/text.test.ts",
    from: `const LINE_BREAK = /\\r\\n?|[\\u2028\\u2029]/gu;`,
    to: `const LINE_BREAK = /\\r\\n?/gu;`,
  },
  {
    id: "revision-fingerprints-the-raw-input",
    what: "hashes what arrived instead of what was reduced, which raises nothing and returns a well-formed hash of the wrong thing",
    file: "packages/law-refs/src/text.ts",
    test: "packages/law-refs/src/text.test.ts",
    from: `      fingerprint: await fingerprintArticleText(reduced.text),`,
    to: `      fingerprint: await fingerprintArticleText(input),`,
  },
  {
    id: "scheduler-overwrites-a-lawyers-judgement",
    what: "lets a probe write over impact_confirmed, so finding the article unchanged puts a paused service back on sale",
    file: "packages/law-refs/src/probe.ts",
    test: "packages/law-refs/src/probe.test.ts",
    from: `const HELD_BY_A_PERSON: readonly LawNormState[] = ["under_review", "impact_confirmed"];`,
    to: `const HELD_BY_A_PERSON: readonly LawNormState[] = [];`,
  },
  {
    id: "a-drift-counts-as-a-verification",
    what: "advances last_verified_at on a drift, so an article that moved renders as freshly confirmed",
    file: "packages/law-refs/src/probe.ts",
    test: "packages/law-refs/src/probe.test.ts",
    from: `      // Deliberately false. \`last_verified_at\` means the last check that
      // succeeded *and matched*; advancing it here would make a norm whose text
      // moved look freshly confirmed, which is §9.10 read backwards.
      markVerified: false,`,
    to: `      markVerified: true,`,
  },
  {
    id: "renormalization-pages-a-lawyer",
    what: "treats our own rule change as the publisher's, so bumping the normalizer files a signal per norm",
    file: "packages/law-refs/src/probe.ts",
    test: "packages/law-refs/src/probe.test.ts",
    from: `      verdict: "renormalized",
      proposedState: "verified",`,
    to: `      verdict: "drifted",
      proposedState: "drifted",`,
  },
  {
    id: "a-future-dated-change-pauses-a-live-service",
    what: "confirms an impact for a law not yet in force, taking a service off sale for a rule nobody has to follow yet",
    file: "packages/law-refs/src/triage.ts",
    test: "packages/law-refs/src/triage.test.ts",
    from: `  const notYetInForce = signal.effectiveDate !== null && signal.effectiveDate > today;`,
    to: `  const notYetInForce = false;`,
  },
  {
    id: "clients-hear-only-once-the-fix-ships",
    what: "holds the client message until remediation, leaving a week in which somebody files a document we know is wrong",
    file: "packages/law-refs/src/triage.ts",
    test: "packages/law-refs/src/triage.test.ts",
    from: `        when: { kind: "immediately" },
        messageKey: "law.signal.impact.client",`,
    to: `        when: { kind: "on_date", date: choice.remediationDue },
        messageKey: "law.signal.impact.client",`,
  },
  {
    id: "audit-mapping-loss-goes-unnoticed",
    what: "stops checking that the surviving audit_change still maps every audited table, so a restatement copied from an older migration silently drops one",
    file: "scripts/check-sql.mjs",
    test: "scripts/check-sql.test.mjs",
    from: `      if (!mapped.has(table)) {`,
    to: `      if (false) {`,
  },
  {
    id: "parser-accepts-any-article-heading",
    what: "matches the first article heading instead of the one asked for, so renumbering makes the fetcher track the neighbouring provision forever",
    file: "packages/law-refs/src/rada.ts",
    test: "packages/law-refs/src/rada.test.ts",
    from: `    (heading) => heading.number.ok && heading.number.article === wanted.article,`,
    to: `    (heading) => heading.number.ok,`,
  },
  {
    id: "parser-welds-an-article-into-one-line",
    what: "strips tags before turning block ends into newlines, so the stored text loses every paragraph break",
    file: "packages/law-refs/src/rada.ts",
    test: "packages/law-refs/src/rada.test.ts",
    from: `  return decodeEntities(html.replace(BLOCK_BREAK, "\\n").replace(ANY_TAG, ""));`,
    to: `  return decodeEntities(html.replace(ANY_TAG, "").replace(BLOCK_BREAK, "\\n"));`,
  },
  {
    id: "fetcher-follows-a-redirect-onto-another-act",
    what: "accepts whichever act the source redirected to, so a consolidated act is fingerprinted as the one we cited and never drifts again",
    file: "supabase/functions/law-article/read.ts",
    test: "supabase/functions/law-article/read.test.ts",
    from: `  if (!landedAct.ok || landedAct.link.actId !== wantedAct.link.actId) {`,
    to: `  if (false) {`,
  },
  {
    id: "failed-check-leaves-no-trace",
    what: "records nothing when a check fails, so an unreachable norm is indistinguishable from one nobody got around to checking (§9.10)",
    file: "supabase/functions/law-article/handler.ts",
    test: "supabase/functions/law-article/handler.test.ts",
    from: `    await deps.store.markChecked({
      normId: norm.id,
      state: "unreachable",`,
    to: `    await Promise.resolve({
      normId: norm.id,
      state: "unreachable",`,
  },
  {
    id: "confirmation-is-taken-on-trust",
    what: "treats any supplied fingerprint as a confirmation without comparing it, so a lawyer confirms text that moved before the save",
    file: "supabase/functions/law-article/handler.ts",
    test: "supabase/functions/law-article/handler.test.ts",
    from: `    request.confirmedFingerprint !== undefined &&
    request.confirmedFingerprint === reading.fingerprint;`,
    to: `    request.confirmedFingerprint !== undefined;`,
  },
  {
    id: "normalizer-bump-probed-as-an-amendment",
    what: "probes a norm left behind by a normalizer bump, which records our own reduction change as the legislature's (§9.7)",
    file: "supabase/functions/law-article/handler.ts",
    test: "supabase/functions/law-article/handler.test.ts",
    from: `  if (norm.fingerprint !== null && norm.normalizerVersion !== NORMALIZER_VERSION) {`,
    to: `  if (false) {`,
  },
  {
    id: "form-saves-an-article-nobody-read",
    what: "drops the requirement that an article-scoped entry was read back, so a mistyped number becomes a permanent row in a register with no delete path",
    file: "apps/console/src/features/law/components/AddReferenceForm.tsx",
    test: "apps/console/src/features/law/components/ServiceLawPage.test.tsx",
    from: `        parsedArticle !== null && parsedArticle.ok && reading !== null);`,
    to: `        parsedArticle !== null && parsedArticle.ok);`,
  },
  {
    id: "stale-reading-still-counts-as-confirmation",
    what: "ignores which article a reading was of, so checking 105 and saving 106 confirms text nobody read",
    file: "apps/console/src/features/law/components/AddReferenceForm.tsx",
    test: "apps/console/src/features/law/components/ServiceLawPage.test.tsx",
    from: `    checkedFor !== null && (checkedFor.url !== url.trim() || checkedFor.article !== article.trim());`,
    to: `    false;`,
  },
  // The cloud-ledger checker's own worst failure is not a wrong message, it is
  // reporting agreement when it was told nothing. `compareLedger([])` is the
  // shape an unlinked project or a wrong --workdir produces, and without the
  // guard it returns zero problems and prints a clean line. This probe removes
  // the guard.
  {
    id: "empty-cloud-ledger-reads-as-agreement",
    what: "lets a ledger with no migrations at all pass as if the cloud agreed",
    file: "scripts/check-cloud-ledger.mjs",
    test: "scripts/check-cloud-ledger.test.mjs",
    from: `  if (rows.length === 0) {`,
    to: `  if (rows.length === -1) {`,
  },
  // The other half: the two directions of drift must stay distinguishable. If
  // an unapplied migration were reported with the hand-edit wording, the
  // message would send a reader to recover SQL that is sitting in the
  // repository — and if a hand edit were reported as unapplied it would send
  // them to `db push`, which is how a hand-made schema change gets buried.
  {
    id: "drift-directions-collapse-into-one-message",
    what: "reports a migration the cloud has and the repository lacks as if it were merely unpushed",
    file: "scripts/check-cloud-ledger.mjs",
    test: "scripts/check-cloud-ledger.test.mjs",
    from: `        "Somebody changed the schema by hand, and that change exists nowhere it can be reproduced from. " +`,
    to: `        "The repository describes a schema the cloud does not have. " +`,
  },
];
