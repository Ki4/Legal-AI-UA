# Legal-AI-UA — root context

Read this before any change. Zone files add detail; this file is the map.

## Stack

- Monorepo: pnpm + Turborepo, Node >= 22, pnpm 10.
- `apps/console` — lawyer/admin cabinet. React + Vite + react-router + Tailwind (semantic tokens
  only) + Supabase JS client.
- `apps/web` — client platform (not built yet).
- `apps/core` (future) — AI generation pipeline, owned by the core owner, called only
  through a Supabase Edge Function gateway. See `docs/adr/0004-ai-core-separate-service.md`.
- `packages/core-client` — typed HTTP contract + mocks for the core, so frontend work proceeds
  before the core exists.
- `packages/ui` — the design system (owned by the design-system owner). Console features consume
  it; it never imports from `apps/*`.
- `packages/db` — mock data + shared types, standing in for Supabase queries until wired.
- `packages/i18n` — uk/en dictionaries (adding a locale is one line — see ADR-0006).
- `supabase/` — migrations, edge functions, seed. See `supabase/CLAUDE.md`.
- `docs/` — vision, ADRs, `docs/CONTRIBUTING.md`, session journals.

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
- CI (`.github/workflows/ci.yml`): lint, typecheck, build on every PR and on push to `main`.
  `main` is always deployable.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm build` from the repo root before opening a PR.

## Where to look next

- `apps/console/CLAUDE.md` — console feature anatomy, routing, Tailwind tokens, role guards.
- `supabase/CLAUDE.md` — migrations, RLS, grants.
- `docs/CONTRIBUTING.md` — ownership zones, git workflow, review policy, spec tiers, GDPR rule,
  the assistant protocol. Read this before your first PR.
