# Legal-AI-UA — root context

Read this before any change. Zone files add detail; this file is the map.

## Stack

- Monorepo: pnpm + Turborepo, Node >= 22, pnpm 10.
- `apps/console` — lawyer/admin cabinet. React + Vite + react-router + Tailwind (semantic tokens
  only) + Supabase JS client.
- `apps/web` — client platform (not built yet).
- `apps/core` (future) — AI generation pipeline, the core zone, called only
  through a Supabase Edge Function gateway. See `docs/adr/0004-ai-core-separate-service.md`.
  Written in **Python** (`docs/adr/0016-core-in-python.md`) — the one package in this repository
  that is not TypeScript, and therefore the one that carries its own lint, format and test lane
  rather than the root `pnpm` scripts.
- `packages/core-client` (planned, not yet created) — typed HTTP contract + mocks for the core, so
  frontend work proceeds before the core exists.
- `packages/ui` — the design system (the design-system zone). Console features consume
  it; it never imports from `apps/*`.
- `packages/db` — mock data + shared types, standing in for Supabase queries until wired.
- `packages/config` — the shared base `tsconfig` packages extend. ADR-0002 also promised ESLint and
  Prettier here; they are single-rooted at the repository root instead, and that is fine while there
  is one lint lane. The ADR records the intent, this line records the state.
- `packages/i18n` — uk/en dictionaries, `t()` and `tCount()` through `useI18n()` (adding a locale
  is one line — see ADR-0006). `uk` is the default and defines the key set; `en` is typed against
  it, so a key added to one and missed in the other fails to compile. Counted phrases go through
  `tCount`, because Ukrainian has three plural forms where English has two and a `count === 1`
  ternary is correct English and wrong Ukrainian. The console shell is adopted; the feature screens
  are not yet.
- `supabase/` — migrations, edge functions, seed. See `supabase/CLAUDE.md`.
- `docs/` — vision, ADRs, specs (`docs/specs/`), `docs/CONTRIBUTING.md`, session journals.
- `.claude/` — `/session-start` and `/session-end`, and a SessionStart hook that puts branch
  state, recent commits and the docs-check result into a fresh session's context.

## Roles are zones, not people

Product owner, core owner, design-system owner name **zones of the repository**. One developer holds
all three. When a doc says "the core owner countersigns" it means the same person in a different
zone — not somebody to wait for, and not a reason to call work blocked. The one rule that genuinely
needs a second person is the access-control review in `docs/CONTRIBUTING.md`, which is suspended
against a named substitute rather than ignored.

## Language rule

Everything that lives in the repo is English, no exceptions in the code itself: code, comments,
commit messages, PR/issue text, ADRs, journal entries. The only exceptions are the `packages/i18n`
locale dictionaries and client-facing legal text, which are content, not repo
artifacts. Talking to your AI assistant in another language is fine — what you commit is not.

**There are two rules here and they have been confused before, so they are stated apart.** The one
above is about repository artifacts. The other one is about the product: it speaks Ukrainian first
and English second (ADR-0006), and every user-visible string is written for **both languages from
the first line** — a key in `packages/i18n`, never a literal in a component. That is not a rule
about translation arriving later; it is the reason it does not have to. A screen written in one
language gets rewritten when the second arrives, because which states exist and which sentence each
one gets are decisions the copy makes. The operational form is `apps/console/CLAUDE.md` ("Copy:
dictionary keys only"); the checkable form is `docs/specs/console-feature-dod.md` §6.

## Feature isolation (apps/console)

Each feature lives in `src/features/<name>/` with `components/`, `api/`, `hooks/`, `index.tsx`.
Features import only from `packages/*` and `shared/` — never from a sibling feature. See
`apps/console/CLAUDE.md` for the full anatomy and the `routes.tsx` single-touch-point rule.

## Quality gates

- Local: Husky + lint-staged run ESLint, Prettier, and commitlint on every commit. Commit
  messages must be Conventional Commits.
- CI (`.github/workflows/ci.yml`): lint, typecheck, test, build on every PR and on push to `main`.
  `main` is always deployable.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` from the repo root before opening a
  PR.
- Tests are Vitest, live beside what they test as `*.test.ts`, and import `describe`/`it`/`expect`
  explicitly rather than relying on globals. Green gates mean the code compiles and conforms — a
  test is how it gets to mean the code behaves.
- One runner, two environments, split by extension: `*.test.ts` runs under `node`, `*.test.tsx`
  under `jsdom` with React Testing Library. `.tsx` is exactly the set of files carrying JSX, which
  is exactly the set that renders, so nothing has to be remembered — and a test that needs no DOM
  does not quietly acquire one. `apps/console/src/test/setup.ts` unmounts between tests; a package
  that grows component tests brings its own setup file into `vitest.config.ts`.
- `pnpm docs:check` runs on every push (git pre-push) and in CI: broken relative links, section
  cross-references pointing at sections that no longer exist, backlog ids cited without a defining
  row. It reports orphaned ADRs as notes without failing. It checks only what is decidable without
  judgement — whether prose is still _true_ is nobody's job but a reader's.

## Where to look next

- `apps/console/CLAUDE.md` — console feature anatomy, routing, Tailwind tokens, role guards.
- `supabase/CLAUDE.md` — migrations, RLS, grants.
- `docs/CONTRIBUTING.md` — ownership zones, git workflow, review policy, spec tiers, GDPR rule,
  the assistant protocol. Read this before your first PR.
- `docs/specs/admin-console.md` — the console's plan: screens, metadata, audit, law monitoring,
  the backlog, and the questions still open.
- `docs/specs/console-feature-dod.md` — what "done" means for a console feature, and how to write
  acceptance criteria. `apps/console/src/features/services` is the reference it describes.
