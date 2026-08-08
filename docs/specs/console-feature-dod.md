# Definition of done — a console feature

- Status: draft for discussion
- Date: 2026-08-04
- Applies to: everything under `apps/console/src/features/`

`features/services` is the reference implementation. This document is what it is a reference _to_ —
the checkable form of "build it like services", so that "like services" does not become two
different readings held by two developers.

Two levels, and they answer different questions:

- **§1–§8 are universal.** Every feature satisfies them regardless of what it does. Nothing here
  is negotiable per task; if an item does not apply, say so in the PR rather than skipping it
  silently.
- **§9 is per task.** Acceptance criteria describe what _this_ screen must do, live on the issue,
  and are written before the work starts (`docs/CONTRIBUTING.md`, Tier 1).

## 1. Structure

- [ ] `src/features/<name>/` with `api/`, `components/`, and `hooks/` if the feature needs one.
- [ ] `index.tsx` exports the feature's `RouteObject[]` and nothing else.
- [ ] `routes.tsx` gained exactly one import and one spread.
- [ ] No import from a sibling feature. Shared code goes to `packages/*` or `src/shared/`.
- [ ] The feature can be deleted by removing its folder and its two lines in `routes.tsx`.

The last item is the real test. If deleting the folder breaks something else, the boundary is not
where it claims to be.

## 2. The `api/` layer

- [ ] `types.ts` — view models and input types for this feature's screens.
- [ ] `contract.ts` — an interface naming every operation.
- [ ] `<name>.mock.ts` — fixture implementation, **annotated with the contract type** so drift
      fails to compile rather than failing in a browser.
- [ ] `index.ts` — one line choosing the implementation, and the feature's public exports.
- [ ] No component imports `supabase` or `@legal-ai/db`. Nothing outside `*.mock.ts` imports
      `shared/api/fixture-store`.
- [ ] Fixtures are shaped exactly as the real response will be, not as the screen finds
      convenient. A convenient fixture invalidates the whole arrangement: components get built
      against a shape that will never arrive.

## 3. The six conventions (ADR-0012)

- [ ] View models, not table rows. Joins happen once in the layer.
- [ ] Timestamps are ISO 8601 strings. Money is integer minor units plus a currency code.
- [ ] Errors are `AppError` with a code from the closed set. **Every mutation checks how many rows
      it affected and turns zero into an explicit error** — an RLS `USING` denial writes nothing
      and reports no error.
- [ ] No Supabase type crosses the boundary.
- [ ] Mutations return the updated entity.
- [ ] Domain vocabulary in `packages/db`; view models in the feature.

## 4. Screen states

Which states exist depends on the screen; that they are visibly distinct does not.

Always:

- [ ] **Loading** — a spinner or skeleton, not an empty table.
- [ ] **Error** — distinguishing at minimum: no rights, not found, and the request never completed.

For a screen showing a collection:

- [ ] **Empty** — the collection genuinely has no rows.
- [ ] **Empty and error do not share a rendering.** "No services yet — create the first one" after
      a failed load tells an admin their catalogue is empty when the request simply broke. This
      shipped in the reference and had to be fixed; it is the single most repeatable mistake here.

For a screen showing one entity:

- [ ] **Not found** — distinct from an error, because a mistyped id and a broken request call for
      different reactions from the reader.

For a route restricted by role:

- [ ] **Access denied** — `RequireAuth` renders this, so the feature inherits it rather than
      building its own. A feature open to every signed-in role has nothing to do here.

## 5. Telling the truth about data

Learned from reviewing the reference, all of which it got wrong first time:

- [ ] **One null means one thing.** If a field can be null for two different reasons — "nobody
      assigned" and "assigned, but the profile is hidden by RLS" — the view model distinguishes
      them and the screen renders them differently. Collapsing them makes the layer state a
      falsehood.
- [ ] **Nothing depends on array order.** Postgres does not promise ordering without `order by`,
      and neither does a fixture. Selecting "the current one" means comparing a field, never
      taking the first match.
- [ ] **Formatters are total.** A helper that throws on unexpected input takes the whole screen
      down with it, because the console has no `ErrorBoundary` yet. Bad data should render as
      visibly odd text.
- [ ] **A stale result is cleared before a new request's outcome is shown.** Rows from a previous
      filter rendered next to a new error read as the new filter's answer.

## 6. Design system

- [ ] Semantic tokens only — no hex, no raw Tailwind palette classes, no raw durations.
- [ ] Status colour only through `Badge tone` or the health mapping, never hand-written.
- [ ] Both themes checked. The theme flips at the CSS variable layer; a component never references
      it.
- [ ] Missing a primitive is a request to the design-system owner, not a local one-off.

## 7. Access

- [ ] Routes that require a role are wrapped in `RequireAuth roles={[...]}`.
- [ ] The role comes from `useAuth()` and therefore from JWT `app_metadata`. Never
      `user_metadata`.
- [ ] Hiding a control in the UI is presentation, not access control. The rule that actually
      protects the data is the RLS policy.

## 8. Verification the PR must carry

`docs/CONTRIBUTING.md` treats any "it works" as a hypothesis until evidence exists, and requires
that at least one piece of evidence show the thing being **invoked** rather than merely defined.
For a console feature that means:

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` clean from the repo root.
- [ ] Every contract operation exercised, including each fallback branch and each error path. The
      reference does this from a script against the fixture implementation; a test runner will
      replace it when one exists.
- [ ] The screen seen rendering, in both themes, with the browser console clean.
- [ ] Anything touching RLS ships a verification scenario: which role, which rows expected, what
      actually happened (`supabase/CLAUDE.md`).

Worth stating plainly, because it is the lesson of this reference: **all three gates were green
while eight defects were present.** Green gates mean the code compiles and conforms, not that it
behaves.

## 9. Acceptance criteria, per task

Criteria go on the issue before work starts. They describe observable behaviour a second person
can check without reading the diff — not implementation.

**Template**

```markdown
## Acceptance criteria

- [ ] <what a person can observe, in their words>

## Out of scope

- <what this task deliberately does not do, so review does not ask for it>

## Evidence

- <how the above was shown to be true>
```

**Rules for writing them**

- Phrased from the user's side. "The list shows the assigned lawyer" — not "`listServices` returns
  `assignedLawyer`".
- Each one independently checkable. If two cannot be verified separately, they are one criterion.
- Negative cases are criteria too. "Deleting a field that is in use is refused, and the screen says
  where it is used" is as much a requirement as the happy path.
- The four screen states from §4 are assumed on every screen task and need not be repeated.

### Worked example — ADM-7, service list on live data

```markdown
## Acceptance criteria

- [ ] The list shows title, generation mode, review mode, status, live version, assigned lawyer
      and price.
- [ ] Filtering by status narrows the list; clearing the filter restores it.
- [ ] Search matches title and slug, case-insensitively.
- [ ] A service with no versions yet shows a dash in every version-derived column, not a zero.
- [ ] A service whose assigned lawyer cannot be read shows "name unavailable", not a dash — a dash
      means nobody is assigned.
- [ ] Clicking a title opens that service's card.

## Out of scope

- Creating a service (ADM-8), assigning a lawyer (ADM-10).

## Evidence

- Contract operations exercised, including the two states above.
- Screenshot of the list in both themes.
```

### Worked example — ADM-19, GDPR attributes on a questionnaire field

```markdown
## Acceptance criteria

- [ ] A field can be marked as personal data.
- [ ] Marking it reveals legal basis and retention, and the field cannot be saved without both.
- [ ] The refusal explains which of the two is missing.
- [ ] An existing field marked as personal data shows its basis and retention when reopened.

## Out of scope

- Enforcing the same rule in the database — that is the migration's check constraint, not this
  screen.

## Evidence

- The save path exercised for: not personal data; personal data complete; personal data missing
  basis; personal data missing retention.
```

### Worked example — ADM-10, assign a service to a lawyer

```markdown
## Acceptance criteria

- [ ] An admin can assign a service to any active lawyer, and unassign it.
- [ ] The change is visible without reloading the page.
- [ ] The same change is visible on the service list.
- [ ] A lawyer, who may not reassign, does not see the control — and if the request is made
      anyway, it is refused with a message rather than reported as saved.

## Out of scope

- A backup or second assignee (open question 18 in docs/specs/admin-console.md).

## Evidence

- RLS verification scenario: assignment attempted as admin and as lawyer, rows affected in each
  case.
```

The last criterion in that example is the shape of this whole document: the interesting
requirement is usually what happens when something is **not** allowed, and that is exactly what a
green build never tells you.

## Known gaps in this document

- **i18n.** The design spec says a component holds no strings, only dictionary keys. `packages/i18n`
  does not exist yet (ADM-37), so this cannot be required. Until it lands, keep user-facing strings
  inside components rather than scattered through `api/`, so extraction is one mechanical pass.
- **No test runner.** Verification in §8 is currently a script per feature. When a runner arrives,
  these become tests and this section shrinks.
- **No `ErrorBoundary`.** §5 requires total formatters because a throw currently takes down a whole
  screen. An app-level boundary would make that requirement softer; it is not built.
