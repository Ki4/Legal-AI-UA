# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

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

## Done — documents sorted by when they are read (2026-08-14)

- **`docs/STATE.md` is tier 1** and the only file a session reads on arrival: the wave, what is in
  flight, the questions that block something and what they block, the debts with the date each was
  first recorded. `/session-start` used to read the ROADMAP, two sections of the console spec, eight
  of the DoD and the latest journal — over a thousand lines to produce a ten-line briefing, most of
  it history no session acts on.
- **The ROADMAP is a map again**: 435 lines to 145. Ten `## Done` sections moved to
  [history/2026-Q3.md](history/2026-Q3.md), read on request. Nothing was deleted and nothing was
  shortened; what changed is that it stopped being mandatory reading.
- **`docs:check` holds the sizes**, because appending a section is easier than moving one, and a
  rule nobody executes is a rule that is absent — which this repository has now learned five times.
  STATE past 60 lines fails; the ROADMAP past 200 lines or three `## Done` sections fails, with the
  message naming the fix. A debt older than three weeks is a **note**, never a failure: a check that
  failed on one would be answered by deleting the line rather than closing the debt.
- **Debts carry the date they were first recorded.** The list used to be retyped into each journal,
  which hid age — `TeamPage` has had no empty state for three sessions, and the access-control review
  has been owed since 2026-08-04. An item carried that long is a decision nobody stated out loud.
- **Archiving is an audit, not a move.** When a section ages out, each lesson in it is asked whether
  a gate, a `CLAUDE.md` rule or the DoD now carries it. "Nothing" is a permitted answer and becomes a
  debt — the same question this repository spent the week asking about its code, turned on its docs.
- The budget check was **green while measuring nothing** on its first run: `contents` is keyed by
  absolute path and the lookup used a repo-relative name, so `undefined` was skipped silently. Found
  by probing, not by reading. It now fails on a missing file rather than shrugging, and three probes
  — oversize, missing, a fourth `## Done` — were each watched going red.

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
shape; `orders` (ADM-63), the first table to carry client data; and the law-reference register
(ADM-21). Orders do not need an event table of their own: `audit_events` is the log, and a new
domain table joins it by gaining an entity mapping in `audit_change` — which raises rather than
logging a null service, so the mapping cannot be forgotten.

**`orders` waits on nothing again, and it took two moves to get there.** On 2026-08-14 this line
was rewritten to say Q21 blocked ADM-63 — whether a client account is a person or a tenant decides
whether the table carries an account id — and that was the right worry to have. It was answered on
2026-08-15 by building the thing first: ADM-62 made `clients` an anchor holding no personal data,
which is the account under either reading, so `orders.client_id` is one column either way. **Q21 is
closed as "tenant"** and membership is ADM-68, deferred to `apps/web`. What the question was really
protecting was the vocabulary — member roles are owner / employee / read-only, never
`admin | lawyer` — and that is now written down (`specs/admin-console.md` §13).

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
  unbuilt — the versions tab with pause/resume, and the orders table with its event timeline
  (ADM-63, ADM-66).
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
- **Client accounts and orders — ADM-62…68**, scoped on 2026-08-14 rather than left as the word
  "deferred": client identity and its pseudonym mapping, `orders` as the first table carrying client
  data, the answers with their provenance, the issued document and its passport, the order card, and
  the per-order review queue. ADM-62 has shipped and Q21 is closed as "tenant", so ADM-63 is next
  and no longer waits on a decision. **ADM-68 — the membership table — stays here on purpose:** a
  ФОП's accountant needs an account to log into before membership means anything, and that is
  `apps/web`. §7.3's three readers of client data are all firm staff, so nothing in the console
  writes a policy that mentions a member.
- Payments, funnel dashboards, pricing — no longer blocked on positioning; they now wait on
  `apps/web` and on real orders.
- Legislative-change monitoring (ADR-0011, spec §9) — the article watcher, the signal triage
  queue and the effective-date calendar; the task list is ADM-41…53, and the register those tasks
  watch is ADM-21…24. Sequenced after the authoring loop; the publication feed is deliberately
  neither built nor bought. One ordering constraint that is easy to get backwards: **citation entry
  and link normalisation (ADM-41, ADM-42) land before the scheduler (ADM-44)**, because watching a
  register of un-normalised links reproduces the pinned-revision trap at scale and its symptom is
  silence.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
