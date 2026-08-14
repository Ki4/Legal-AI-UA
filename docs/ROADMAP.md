# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Done — bootstrap (2026-08-01)

- Monorepo: pnpm + Turborepo, ESLint/Prettier/TS strict, Husky + lint-staged + commitlint, CI
  (lint → typecheck → test → docs:check → build on every PR/push). `main` always deployable.
- Supabase project (EU Frankfurt): auth migration with registration → pending approval →
  `approve_user` RPC; roles (`admin | lawyer`) in JWT `app_metadata`, RLS on `profiles`.
  Verified live end-to-end.
- Console carcass (`apps/console`): isolated feature tracks meeting only in `routes.tsx`;
  auth pages, role guards, AppShell (fixed sidebar, scrollable content).
- Design system (`packages/ui`): full token set (color, type, radii, elevation, motion,
  z-scale), both themes via `data-theme`, AA-safe status ink pairs, exemplar components
  (Button, IconButton, Badge, FormField, Input, Textarea, Spinner), trust layer
  (Provenance, Confidence, Citation), Table, EmptyState. Live gallery at `/design`.
- Anatomy screen renders a mock generation trace through the trust components.
- Docs: VISION, ADR 0001–0006, CONTRIBUTING, root + zone CLAUDE.md, design spec
  (`docs/design/design-system.md`), session journal.

## Done — console planning and the data-access layer (2026-08-04)

- `docs/specs/admin-console.md` — the console's own spec: route map, 14 screens with user
  stories, template metadata versus issued-document metadata, the document passport, the audit
  model, GDPR consequences, the commercial model, legislative-change monitoring, backlog
  ADM-1…53 with dependencies, waves, the two-developer split, decisions taken, and 18 open
  questions.
- ADR-0008…0012: templates from uploaded documents instead of a Word add-in; issued documents
  pin frozen versions; append-only audit with pseudonymous subjects; monitoring legislative
  change; the feature-local `api/` layer.
- `docs/specs/console-feature-dod.md` — what "done" means for a console feature, and the
  template for per-task acceptance criteria.
- Vitest as the workspace runner; `pnpm test` joins the gates locally and in CI.
- The `api/` layer exists, with `features/services` as the reference every other feature copies:
  view models over rows, a typed contract, one swap point from fixtures to Supabase, `AppError`
  with `expectOne` for RLS-denied writes, one shared fixture store. `packages/db` reshaped to row
  types; price in integer minor units plus currency.

## Done — the data-model decisions (2026-08-11)

- ADR-0013: the client's intake channel is a chat bot; the field dictionary stays canonical and
  channel-independent, the transcript is provenance only, an extracted answer must be confirmed
  before it feeds generation, and erasure gains a second mechanism.
- ADR-0014: role governs platform capability, assignment governs case data; admins are
  depersonalised by default with break-glass as the recorded exception; clients do not live in
  `profiles`.
- `docs/specs/admin-console.md` §5.5 (where an answer comes from), §7.2 (the retention schedule),
  §7.3 (who may read client data), §8.6 (entitlements and per-currency prices); backlog
  ADM-54…57. Open questions Q10–Q13 closed; questions now carry stable ids.

## Done — the first domain migrations (2026-08-11)

- `services`, `service_versions`, `service_version_prices`. ADR-0009 enforced by triggers:
  published versions frozen and undeletable, prices frozen with them, one live slot per service.
  Carries the ADR-0005 constraint that had never been implemented — `block_assembly` and
  `full_generation` can no longer be configured to skip lawyer review.
- `questionnaire_fields`: the canonical per-service dictionary, GDPR triad enforced by constraint
  (ADR-0008), Art. 9 special-category marker with its own basis (ADR-0013), keys immutable.
- `audit_events` (ADM-6): the append-only action log of ADR-0010. Written by a `SECURITY DEFINER`
  trigger with no INSERT grant anywhere else, immutable against UPDATE/DELETE/TRUNCATE, redaction
  of personal-data columns by trigger argument. The access log waits for client data and the
  gateway (§6.2).
- `service_assignments`: several lawyers per service with exactly one accountable, enforced by a
  partial unique index. Cover carries the same rights and none of the obligation; the accountable
  lawyer arranges their own cover, only an admin moves accountability, and it moves through an
  RPC so a half-finished handover cannot leave a service with nobody answering for it. Staff can
  read staff names; a registration awaiting approval cannot. Closes Q18.
- The service list runs on live data (ADM-7). The swap point changed one line and no component
  moved, which is the first test of the claim ADR-0012 was written to make. `packages/db` now
  derives row types from the schema (`pnpm db:types`): rows are snake_case, view models stay
  camelCase, and the api/ layer is the translation.
- Verification scripts at `supabase/snippets/verify_*.sql` — runnable, denials covered, and now
  the required form for any policy (`supabase/CLAUDE.md`). 79 scenarios across four files.
- Two defects in already-deployed schema, found by an adversarial probe rather than by review:
  a version could hold the live slot without being published (and so stayed editable), and a
  published version could walk back to `draft`. Both closed; both had passed a green 23-scenario
  verification.

## Done — the card, and what a lawyer needs to see (2026-08-12)

- The service card runs on live data (ADM-58). The list and the card had been reading different
  sources, so every row in the list led to "Service not found" — two screens on two sources of
  truth disagree about which records exist, not merely about content. Found by clicking around a
  freshly seeded sandbox; no gate can see it, because both halves were individually correct.
- `docs/specs/admin-console.md` §4.4 gains the field map (used / extra / missing) and §4.5 the
  branching view. The tree of questions is a projection of block conditions over the field
  dictionary, computed rather than authored: there is deliberately no editor for the chat bot's
  script, because a second place to author the flow is a second source of truth (ADR-0013). Q19
  opens on where a field's group lives.
- The cloud project's migration ledger is **repaired** — seven rows, matching the filenames in
  `supabase/migrations/` exactly. This closes the first item under "Left open" in the 2026-08-11
  journal, which is where a reader would otherwise still find it recorded as outstanding.
  `supabase db push` is unblocked. The CLI was not linked at that point; it was on 2026-08-13 —
  see below.
- The root map claimed `packages/core-client` and `packages/i18n` as parts of the repository.
  Neither directory exists; both are marked planned. `docs:check` cannot catch this — a package
  that was never created is not a broken link.
- The card assigns lawyers (ADM-10). The schema, the RPC and the policies had been in place since
  2026-08-11 and `setPrimaryLawyer` had been written as an exemplar and never called — what was
  missing was the screen, and a card view model that could express cover at all. There is no
  dropdown, because `packages/ui` has no Select yet and a local one-off is what the DoD forbids.
  Cover deletion gained the four verification scenarios nothing had covered: every scenario before
  them tested who may _add_ an assignment, and a DELETE is the half that fails silently. One of
  them turned scenario 11 red, correctly — it had been reading the audit log as whichever lawyer
  the previous scenario left in the session. A scenario that depends on the order of the ones
  before it measures the script, not the schema.

## Done — the catalogue gains an axis (2026-08-13)

- ADR-0015 and spec §5.6: a service sits in exactly one practice area, a lawyer holds competences
  an admin grants, and competence steers the assignment picker without locking the table. The
  client's rubrics and the client's industry are separate axes — Ukrainian firms' own service
  pages list `сімейне` next to `IT`, which is three axes flattened into one menu because a menu is
  all a website has.
- `practice_areas` (ADM-59), keyed by its code and seeded with fifteen branches. A table rather
  than an enum so that the first maritime matter is an insert, not a deploy. `services.practice_area`
  is `not null`; existing rows backfilled to `civil`, because an axis half the catalogue lacks is
  not an axis.
- The catalogue is browsable (ADM-61): cards by default grouped by area, the table for scanning,
  chips carrying their counts, search over title, slug and summary, and filter state in the URL so
  a narrowed catalogue is a link. Three emptinesses — nothing exists, nothing matches, the request
  failed — rather than the one screen lists usually collapse them into.
- The assignment editor landed on the card (ADM-10). Everything it needed had existed since
  2026-08-11: the table, the RPC, the policies, and `setPrimaryLawyer` written as an exemplar and
  never called. What was missing was the screen, which is a shape worth recognising — work can look
  blocked when it is only unassembled.
- Two failures that only appeared because something new leaned on the old: a verification scenario
  that had been passing because of the session state a previous scenario left behind, and four
  scripts whose fixtures predated a `not null` column. Both were found by adding scenarios rather
  than by reading. 98 scenarios across five files now.
- The CLI is linked, and both ledgers hold the same eight versions. The practice-area migration had
  been applied to the cloud by hand, so `db push` would have tried to create a table that already
  exists — `migration repair` was the instrument, and knowing which one required looking rather
  than assuming. `db diff` confirmed the hand-application was complete _before_ the ledger was told
  it was: a version recorded as applied when it only half was is worse than one that is missing.
  The same drift had appeared locally that morning, one day after the journal wrote it down for the
  cloud, which is why `supabase/CLAUDE.md` now carries the rule rather than the story.
- ADR-0016 closes the one question ADR-0004 deliberately left open: the core is Python. Neither the
  agent framework nor the Claude SDK decided it — LangGraph and the Anthropic SDK are at parity
  across both languages. DOCX did. The Claude API reads a PDF natively, so PDF needs no library at
  all; DOCX is not a native input type, has to be parsed locally, and is the format Ukrainian firms
  actually work in. `python-docx` reads and writes numbering and styles through one object model,
  which is the round trip the product is made of. The price is a second toolchain, and the ADR says
  so rather than pretending otherwise.
- Two things live in the cloud that no migration creates, found by that same diff and left alone
  deliberately: the `ensure_rls` event trigger with `rls_auto_enable`, which enables RLS on any new
  table by itself, and `alter default privileges … revoke update on sequences` for the three client
  roles. The first means the two environments disagree about what protects a table that forgot its
  own `enable row level security` — the cloud is covered, the sandbox where it would be caught is
  not. The second looks like ADR-0007 applied through the dashboard and never captured, which
  `supabase/CLAUDE.md` forbids. Both need a decision: written into a migration, or recorded as
  accepted divergence.
- **Both decided, differently** (ADR-0017). The sequence revoke was a gap in ADR-0007 and is now a
  migration: `public` holds exactly one sequence, `audit_events_id_seq`, and `w` on it is the
  privilege `setval()` needs — a sequence wound back to 1 collides with an existing id, the
  `SECURITY DEFINER` audit trigger raises, and the domain write dies with it. Not reachable through
  PostgREST today, and fixed for the reason ADR-0007 gave: the rule is what reviews are measured
  against. The `ensure_rls` trigger is **not** copied. A trigger that switches RLS on by itself
  removes the mistake and the evidence together, and leaves the sandbox — where mistakes are
  supposed to surface — as the environment without the net. Its place is taken by an assertion that
  goes red in CI and names the table. The trigger stays in the cloud as an accepted divergence,
  recorded rather than remembered, because nobody has read its body and replacing a production
  safety object with a guess is the thing this repository keeps learning not to do.

## Done — the console speaks Ukrainian (2026-08-13)

- `packages/i18n` exists and the shell is adopted: `uk` is the default because the users are
  Ukrainian — lawyers in the console, clients on the platform — while the repository stays English
  (root `CLAUDE.md`). The two facts are unrelated and were being confused.
- `uk` defines the key set and `en` is typed against it, so a key added to one and missed in the
  other is a compile error rather than a blank label somebody finds in production.
- Counted phrases go through `Intl.PluralRules`, not a ternary. The catalogue already had
  `count === 1 ? "service matches" : "services match"` — correct English, wrong Ukrainian, and
  invisible until somebody counts to five. Ukrainian needs three forms: 1 послуга, 3 послуги,
  5 послуг, and round again at 21.
- The switcher is `Select` plus locale state rather than a new primitive, renders from
  `LOCALES.map`, and shows endonyms — no flags, because a language is not a country and here that
  mapping is politically loaded (ADR-0006).
- Not adopted at that point: every feature screen. The shell was bilingual and the catalogue
  underneath it was not, which is a visible half-state and the reason that was one PR rather than
  three.

## Done — the console speaks both languages, end to end (2026-08-14)

Part of ADM-37, continuing the entry above.

- `features/services` and `features/service-detail` hold no copy in JSX: the catalogue with its
  filters and both renderings, the three emptinesses, the service card and the assignment editor.
- Three kinds of text turned out to need three different mechanisms, and conflating them is what
  makes a half-translated screen:
  - **Interface copy** is a dictionary key.
  - **Enum values** — status, generation mode, review mode — go through `shared/vocabulary.ts`, a
    `Record<Enum, TranslationKey>` per enum. Adding a value in a migration now fails to compile
    here, which is the only moment anybody remembers the new state also needs a word. The role is
    deliberately excluded: `admin` and `lawyer` are the words an RLS policy is written in.
  - **Reference data** — practice-area labels — is neither. An admin adds an area at runtime
    (ADR-0015), so no dictionary shipped with the build can name it; the row carries a label per
    language and `PracticeAreaRef.labels` carries them to the screen. That is the "one line that
    changes" the type comment had been promising since 2026-08-12.
- Errors are held in state as keys, not sentences. A translated string in state is frozen in the
  language it was produced in, so switching while an error is on screen used to leave the old one
  there. `AssignmentSection` also stopped falling through to `error.message` — developer text
  ("expected one record, got 2"), in English, shown to a lawyer.
- `formatMoney` and `formatDate` now require a locale instead of defaulting to `uk-UA`. The default
  was right by accident while there was one language and silently wrong the moment there were two.
- `team` and `account` followed in the same PR, and so did the screens before sign-in. `design-kit`
  and `anatomy` are deliberately out — the gallery documents components for developers, and the
  anatomy screen renders a hardcoded trace whose text is fixture content, not copy.
- **The switcher was unreachable by the people most likely to need it.** It has existed since the
  shell was adopted, and it lives in `AppShell` — which renders only for a signed-in user who
  already has a role. A lawyer landing on the login page in the wrong language had no way to change
  it. It is now on `/login`, `/register` and the pending-approval screen, in the same position on
  all three.
- Supabase's auth errors stopped being shown raw. `signInError.message` is English prose from the
  auth server, reworded between releases; `authErrors.ts` maps `AuthError.code` instead, and the
  rule it carries is that matching on the message is a translation that stops working silently on
  an upgrade — by falling back to English, which is the failure nobody reports.
- The rule is written down where the next screen will meet it: root `CLAUDE.md` separates the two
  language rules that had been confused with each other — the repository is English, the product is
  Ukrainian-first and every string is written for both languages from the first line;
  `apps/console/CLAUDE.md` holds the operational form; `console-feature-dod.md` §6 holds the
  checkable one. §6 was **renamed** from "Design system" to "Design system and copy" rather than a
  section being inserted, because "DoD §5/§6/§7/§8" is cited from a dozen source comments and
  renumbering would have silently repointed every one of them.
- What the parallel split could not see: `authErrorKey` was written twice, identically, because the
  two screens were handed out as one zone and the shared module would have been a third. Merging is
  where that becomes visible, and it is worth expecting rather than rediscovering.

## Done — the gates that can go red (2026-08-14)

A session with no new feature in it. Four debts, each one an instance of the same shape the
2026-08-14 journal named: the gate is green because the thing that would have gone red never ran.

- **Copy and token discipline is checked** (`pnpm check:copy`, the third checker after `docs:check`
  and `check:sql`). It reads the AST through the TypeScript compiler API rather than grepping,
  because a regex cannot tell a `JsxText` node from a `className`, and a check that cries wolf is
  disabled within a week. Its summary counts nodes _considered_ — 131 `className` strings, 15
  attributes — since "found nothing" and "looked at nothing" are the two states this repository
  keeps confusing. It found one violation, a hardcoded `Make accountable` beside a dictionary key
  of that name that already existed. DoD §6 now also records what no script can decide, so a green
  run is not read as a satisfied section.
- **Row types are derived from the query instead of asserted over it.** `supabase.ts` claimed the
  generated schema caught a query naming a dropped column; `.returns<T>()` is an assertion and
  discarded exactly that. `QueryData<ReturnType<typeof query>>` replaces the hand-written rows in
  all three `api/` files, which forced the runtime-composed select string into two literals —
  inference needs a literal. Diverging them is caught. One field stays hand-asserted, because a
  NOT NULL foreign key makes the compiler infer an embedded profile as always present and RLS can
  still hide the row; it derives from the inferred shape and says which half is checked.
- **Generated types can no longer go quietly stale.** `sql.yml` regenerates against the database it
  just rebuilt from the PR's own migrations and diffs, so a stale `database.types.ts` fails on the
  PR that staled it rather than on whoever regenerates next. That is what stands behind
  `shared/vocabulary.ts` being exhaustive.
- **`anatomy` reaches its data through `api/`**, so the rule in `apps/console/CLAUDE.md` holds
  everywhere rather than everywhere except the file a reader meets first. The migration introduced
  a state the screen never had — it could not previously wait or fail — and the first version
  handled neither, which is worth remembering about cheap refactors.
- **Staged Python meets an actionable hook.** `lint-staged` has routed `*.py` at a `ruff` that is
  installed nowhere since ADR-0016. The guard resolves the path and spawns that path rather than
  answering yes/no and spawning a bare name — on Windows those disagree for a `.cmd` shim, which
  would have reproduced the same fault one line below its own fix.
- **ADR-0017's open condition is discharged.** The `ensure_rls` function in the cloud had never
  been read; it has been now, and the decision not to copy it stands. It swallows its own failures
  into the Postgres log, and it creates no policy — so a migration that grants a client role its
  `select` and forgets `enable row level security` gives a working screen in the sandbox and an
  empty one in the cloud. That direction was written nowhere.

Neither new script had a test when this section was written. Both were watched going red by hand —
every rule of `check:copy` against a probe file, and the type gate against a dropped column in two
features — which is evidence, and is not the same thing as a gate that stays honest without
somebody remembering to check it. That was the same shape as the entries above, one level up.
**Closed below**, on the same day, in the two sections that follow.

## Done — the first screen that is checked by something other than a reader (2026-08-14)

- **A DOM environment, and one screen tested in it.** `vitest.config.ts` became two projects split
  by extension: `*.test.ts` under `node`, `*.test.tsx` under `jsdom` with React Testing Library.
  `.tsx` is exactly the set of files carrying JSX, which is exactly the set that renders, so the
  rule needs nothing anybody has to remember — and a unit test does not silently acquire a
  `document` the code under test will not have. `environmentMatchGlobs` said this in one line and
  was removed in Vitest 4.
- The catalogue's §4.1 rule is now an assertion: "nothing exists", "nothing matches your filter"
  and "the request failed" are three screens. All three branches return an `EmptyState`, all three
  compile, and until now the only thing deciding which sentence a lawyer reads on a blank screen
  was a reader. Seven tests over the loading state, the rendered list, the three emptinesses, the
  "2 matches elsewhere" count and the retry button.
- The test mocks `../api` — the feature's own contract, the boundary ADR-0012 put there. Expected
  text comes from `translate(DEFAULT_LOCALE, key)`, not from the Ukrainian sentence: the claim
  under test is which key a branch picked, and rewording a dictionary is not a regression.
- One assertion is the i18n rule rather than a behaviour: an `AppError`'s `message` — developer
  text, always English — must not be on screen. `check:copy` can see a literal in a component;
  only this can see one arriving through state.
- **Watched going red, seven ways**, because this session's whole subject is that a green test
  proves nothing until it has been seen failing. Collapsing two emptinesses into one, forcing the
  elsewhere-count to zero, unwiring the retry button, letting developer text through to the render
  and removing the loading branch each turned exactly one test red. Removing the cleanup setup file
  turned five red, and removing the Supabase env block stopped the file from loading at all — so
  both halves of the new config are load-bearing rather than ceremony.
- DoD §8 now requires it: the §4 states covered by a `*.test.tsx` beside the component. It binds
  new work; the screens already shipped are not retrofitted, and §"Known gaps" says so.

## Done — the checkers are checked (2026-08-14)

- **`check:copy` and `py-lane` have tests**, 41 of them, and the vitest runner collects
  `scripts/**/*.test.mjs` so a gate can no longer be the one thing nothing runs. Both scripts kept
  their behaviour and gained a seam: `check-copy.mjs` exports `checkSource(relPath, text)` and runs
  the CLI only when invoked as one, `py-lane.mjs` exports the four functions that decide how a
  command line is built. The summary line `check:copy` prints on the real tree is byte-identical
  before and after the refactor, which is the only evidence that matters for a refactor of a gate.
- Every rule gets both halves: a source that must trip it and the source one line away that must
  not. A checker that flags everything and a checker that flags nothing are equally useless, and
  only the pair tells them apart. The probe file that used to be driven by hand is now fixtures.
- **The injection test runs the real shell.** `py-lane`'s quoting is not asserted as a string
  shape; the built command line is handed to an actual `cmd.exe` with a staged filename of
  `apps/core/x & echo INJECTED`, and the test checks the second half did not run. Its companion
  feeds the unquoted form — the shape `shell: true` builds — and asserts that one _does_ run it, so
  the first test cannot pass against a shell that executes nothing. Windows-only and skipped on
  ubuntu CI, which is stated in the file rather than left to be discovered.
- Reverting `buildCmdLine` to the vulnerable form turns three tests red, one of them the live
  `cmd.exe` one; dropping `aria-label` from the user-visible attribute set turns exactly one red.
  Both were run.
- Two of the new tests failed on their first run and both were the test being wrong, which is worth
  recording: one probe carried a stray letter that tripped the JSX-text rule, and one assumed a
  reason-less `check-copy-ignore` still suppressed the line below it. It does not — a malformed
  directive is not a half-working one — and that behaviour is now asserted rather than incidental.
- **Still open: `check-docs.mjs` and `check-sql.mjs` have no tests** and have had none for longer.
  They were not touched here because a refactor of a gate is only safe next to the evidence that its
  output did not move, and doing three at once buys that evidence for none of them.

## Done — approve_user stops being two operations (2026-08-14)

- **ADR-0018.** `approve_user` has written a role into `app_metadata` for whatever id it was handed
  since the first migration, so it was always both the approval the team screen calls and the role
  change ADM-33 has not built. A stale list turned "approve as lawyer" into a demotion of a
  colleague; an admin could demote the last admin, themselves included, with the SQL editor as the
  only recovery; and approving a user id that does not exist reported success. It now grants a first
  role, refuses a target that holds one, no-ops on a repeat of the same role, raises on a target
  that does not exist, and reads the authority rather than the display mirror — repairing the mirror
  when the two have drifted apart.
- **Run against the July function, six of the thirteen scenarios fail**, including the self-demotion
  and the silent success on a nonexistent user; against the migration, all thirteen pass. That
  comparison is the point of the script. A verification only ever run against the fixed code proves
  that today's code agrees with today's assertions.
- The console's fixture moved with the schema. `team.mock.ts` had refused nothing on the recorded
  grounds that a mock stricter than the database teaches a rule Postgres will not honour; the same
  reasoning now points the other way, and the test that asserted the old behaviour asserts the new
  one.
- Left out deliberately and written into the ADR: the role-change RPC itself, which needs a rule
  about the last admin and belongs with its screen; and an audit row for a role grant, which needs
  `profiles` to gain an entity mapping in `audit_change()` and would start logging every
  registration.
- Access control, merged under the one-developer suspension clause. It joins the list owed a review.

## Now — wave 1 (parallel, no file overlap)

**Design system completion** (the design-system zone; DoD per design spec §11 for every item):

1. ~~Select~~ (shipped — native, deliberately: the popover a custom listbox needs is item 2, and
   building it as a side effect of wanting a dropdown is how a shared primitive ends up shaped by
   the first screen that needed one) · Checkbox · Radio · Switch (form controls to match FormField).
2. Popover infrastructure → Tooltip · DropdownMenu; then Citation gains its §8.3 popover.
3. Dialog · Sheet · ConfirmModal + `useConfirm()`.
4. Toast · Alert · ProgressBar (first animated components — must land with the
   `prefers-reduced-motion` behavior intact).
5. Tabs · Accordion · Pagination · table sorting.
6. StatCard · ChartCard · Avatar · Breadcrumbs. LangSwitcher is deliberately **not** here any
   more: it lives in `apps/console/src/app/` as `Select` plus locale state, because a design system
   that renders the switcher has to import the dictionary and start knowing which languages the
   product speaks.

**Data layer** (PO): the catalogue half shipped — see the section above. What remains is
`document_blocks`, which waits on the trace schema below because the two constrain each other's
shape; `orders`, the first table to carry client data; and the law-reference register. Orders do
not need an event table of their own: `audit_events` is the log, and a new domain table joins it
by gaining an entity mapping in `audit_change` — which raises rather than logging a null service,
so the mapping cannot be forgotten. Client-bearing tables wait on nothing else now that Q10–Q13
are closed.

**Core contract** (drafted in the PO zone, checked against the core zone — the same developer, so
what stands in for a countersignature is that the mocks run and the schema is written down rather
than agreed): `packages/core-client` — typed HTTP
contract + MSW mocks; the generation trace schema (stable block IDs, trust status,
`needs_attention`, law/questionnaire refs, tool calls) frozen **before** the generator is
written. The language question ADR-0004 left open is closed — the core is Python (ADR-0016) — so
the trace schema is written as a schema both sides conform to, not as a TypeScript type the
console happens to own.

## Next — wave 2

- Console screens on real data: the catalogue with its filters and two views (ADM-7, ADM-61), the
  service card (ADM-58) and the assignment editor on it (ADM-10) are there. Still on fixtures or
  unbuilt — the versions tab with pause/resume, and the orders table with its event timeline.
  Every feature now reaches its data through its own `api/` layer, `anatomy` included.
- Lawyer competences and the picker that reads them (ADM-60). The picker offers every approved
  lawyer today, which is right for a firm with two and absurd for one with twenty. Its shape waits
  on Q20 — whether a competence records the certificate behind it, which turns an internal opinion
  into a claim the firm makes about a person, with a retention question attached.
- Component tests for the screens that do not have one. The environment exists and the catalogue is
  covered (see below); every other screen's rendering is still a claim somebody made by looking.
- Edge Function gateway skeleton: JWT check → rights check → audit → core call.
- Core: LangGraph pipeline behind the frozen contract (the core zone).

## Later (deliberately deferred)

- Client platform `apps/web` — the channel question is now answered: intake is conversational
  (ADR-0013), and the chat primitives are specified in design spec §16 but not built. Positioning
  is answered too: one-off purchase and platform subscription, priced in UAH
  (`docs/specs/admin-console.md` §8, §8.6). The amounts themselves are still open (Q9).
- Payments, funnel dashboards, pricing — no longer blocked on positioning; they now wait on
  `apps/web` and on real orders.
- Legislative-change monitoring (ADR-0011, spec §9) — the article watcher, the signal triage
  queue and the effective-date calendar. Sequenced after the authoring loop; the publication
  feed is deliberately neither built nor bought.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
