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

## Now — wave 1 (parallel, no file overlap)

**Design system completion** (design-system owner; DoD per design spec §11 for every item):

1. Select · Checkbox · Radio · Switch (form controls to match FormField).
2. Popover infrastructure → Tooltip · DropdownMenu; then Citation gains its §8.3 popover.
3. Dialog · Sheet · ConfirmModal + `useConfirm()`.
4. Toast · Alert · ProgressBar (first animated components — must land with the
   `prefers-reduced-motion` behavior intact).
5. Tabs · Accordion · Pagination · table sorting.
6. StatCard · ChartCard · Avatar · Breadcrumbs · LangSwitcher.

**Data layer** (PO): domain migrations — `services` + `service_versions`
(`generation_mode`, `review_mode`), per-currency price rows, `document_blocks`, questionnaire
fields with the GDPR triad and the Art. 9 marker, `orders` + `order_events` (append-only), law
refs; freeze triggers per ADR-0009; explicit grants + RLS keyed on assignment rather than role
(ADR-0014), with a verification scenario per policy; seed; generated types replacing the
hand-written mocks in `packages/db`. Client-bearing tables wait on nothing else now that Q10–Q13
are closed.

**Core contract** (PO drafts, core owner countersigns): `packages/core-client` — typed HTTP
contract + MSW mocks; the generation trace schema (stable block IDs, trust status,
`needs_attention`, law/questionnaire refs, tool calls) frozen **before** the generator is
written.

## Next — wave 2

- Console screens on real data: orders table + order card with event timeline, service editor
  with pause/resume, lawyers, profile.
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
