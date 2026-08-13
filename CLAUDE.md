# Legal-AI-UA — root context

Read this before any change. Zone files add detail; this file is the map.

## Stack

- Monorepo: pnpm + Turborepo, Node >= 22, pnpm 10.
- `apps/console` — lawyer/admin cabinet. React + Vite + react-router + Tailwind (semantic tokens
  only) + Supabase JS client.
- `apps/web` — client platform (not built yet).
- `apps/core` (future) — AI generation pipeline, owned by the core owner, called only
  through a Supabase Edge Function gateway. See `docs/adr/0004-ai-core-separate-service.md`.
  Written in **Python** (`docs/adr/0016-core-in-python.md`) — the one package in this repository
  that is not TypeScript, and therefore the one that carries its own lint, format and test lane
  rather than the root `pnpm` scripts.
- `packages/core-client` (planned, not yet created) — typed HTTP contract + mocks for the core, so
  frontend work proceeds before the core exists.
- `packages/ui` — the design system (owned by the design-system owner). Console features consume
  it; it never imports from `apps/*`.
- `packages/db` — mock data + shared types, standing in for Supabase queries until wired.
- `packages/i18n` (planned, not yet created) — uk/en dictionaries (adding a locale is one line —
  see ADR-0006). Console copy is hardcoded English until it exists.
- `supabase/` — migrations, edge functions, seed. See `supabase/CLAUDE.md`.
- `docs/` — vision, ADRs, specs (`docs/specs/`), `docs/CONTRIBUTING.md`, session journals.
- `.claude/` — `/session-start` and `/session-end`, and a SessionStart hook that puts branch
  state, recent commits and the docs-check result into a fresh session's context.

## Language rule

Everything that lives in the repo is English, no exceptions in the code itself: code, comments,
commit messages, PR/issue text, ADRs, journal entries. The only exceptions are the `packages/i18n`
locale dictionaries and client-facing legal text, which are content, not repo
artifacts. Talking to your AI assistant in another language is fine — what you commit is not.

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
