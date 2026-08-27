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
    from: `title={t("serviceFields.failed.title")} hint={t("serviceFields.failed.hint")}`,
    to: `title={t("serviceFields.empty.title")} hint={t("serviceFields.empty.hint")}`,
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
];
