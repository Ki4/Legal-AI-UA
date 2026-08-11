# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner.

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

## Now — wave 1 (parallel, no file overlap)

**Design system completion** (design-system owner; DoD per design spec §11 for every item):

1. Select · Checkbox · Radio · Switch (form controls to match FormField).
2. Popover infrastructure → Tooltip · DropdownMenu; then Citation gains its §8.3 popover.
3. Dialog · Sheet · ConfirmModal + `useConfirm()`.
4. Toast · Alert · ProgressBar (first animated components — must land with the
   `prefers-reduced-motion` behavior intact).
5. Tabs · Accordion · Pagination · table sorting.
6. StatCard · ChartCard · Avatar · Breadcrumbs · LangSwitcher.

**Data layer** (PO): the catalogue half shipped — see the section above. What remains is
`document_blocks`, which waits on the trace schema below because the two constrain each other's
shape; `orders`, the first table to carry client data; and the law-reference register. Orders do
not need an event table of their own: `audit_events` is the log, and a new domain table joins it
by gaining an entity mapping in `audit_change` — which raises rather than logging a null service,
so the mapping cannot be forgotten. Client-bearing tables wait on nothing else now that Q10–Q13
are closed.

**Core contract** (PO drafts, core owner countersigns): `packages/core-client` — typed HTTP
contract + MSW mocks; the generation trace schema (stable block IDs, trust status,
`needs_attention`, law/questionnaire refs, tool calls) frozen **before** the generator is
written.

## Next — wave 2

- Console screens on real data: the service list is there (ADM-7). Still on fixtures or unbuilt —
  the service card, the versions tab with pause/resume, the assignment editor (ADM-10, whose RPC
  already exists), and the orders table with its event timeline. `team` and `anatomy` never joined
  the api/ layer at all, and `team` is now the only feature querying Supabase outside it.
- `packages/i18n` (uk + en; adding a locale = one line, per ADR-0006) and dictionary adoption
  in console.
- Edge Function gateway skeleton: JWT check → rights check → audit → core call.
- Core: LangGraph pipeline behind the countersigned contract (core owner's zone).

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
