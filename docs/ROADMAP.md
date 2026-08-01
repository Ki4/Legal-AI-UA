# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Owners: PO (Sergey), core owner (senior dev), design-system owner (junior dev).

## Done — bootstrap (2026-08-01)

- Monorepo: pnpm + Turborepo, ESLint/Prettier/TS strict, Husky + lint-staged + commitlint, CI
  (lint → typecheck → build on every PR/push). `main` always deployable.
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
(`generation_mode`, `review_mode`), `document_blocks`, `orders` + `order_events` (append-only),
law refs; explicit grants + RLS with a verification scenario per policy; seed; generated types
replacing the hand-written mocks in `packages/db`.

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

- Client platform `apps/web` — blocked on the chat-vs-forms channel spec (design spec §16)
  and the one-off vs subscription positioning question (VISION, open question).
- Payments, funnel dashboards, pricing — blocked on the same positioning answer.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
