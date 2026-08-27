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
- `packages/core-client` — the contract with the core, so frontend work proceeds before the core
  exists. The authority is `schema/*.schema.json`, not this package's TypeScript and not the core's
  Python: three runtimes have to agree about one payload and none of them can outrank the other two
  (ADR-0016). The hand-written types are held to the schema by the bridge constants beside them and
  the test that compares the two — see `docs/adr/0021-core-contract-is-json-schema-with-bridge-tests.md`,
  which also records why the drift argument that looks sufficient is not. Dependency-free at
  runtime, like `packages/law-refs` and for the same reason: the Deno gateway will import it.
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
- `docs/` — vision, ADRs, specs (`docs/specs/`), `docs/CONTRIBUTING.md`, session journals. **Sorted
  by when they are read, not by what they are about** — see "Documents have tiers" below.
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
- The checkers under `scripts/` are collected too, as `scripts/**/*.test.mjs`. A gate nothing runs
  is the exact defect they were written to catch. Each one exports its core and runs its CLI only
  when invoked as one, so a test can call it without walking the repository or exiting the runner.
  `check-copy.mjs` and `py-lane.mjs` are covered; `check-docs.mjs` and `check-sql.mjs` are not yet.
  A checker's rule is asserted in **both halves**: a source that must trip it, and the source one
  line away that must not. A checker that flags everything and one that flags nothing are equally
  useless, and only the pair tells them apart.
- `pnpm docs:check` runs on every push (git pre-push) and in CI: broken relative links, section
  cross-references pointing at sections that no longer exist, backlog ids cited without a defining
  row. It reports orphaned ADRs as notes without failing. It checks only what is decidable without
  judgement — whether prose is still _true_ is nobody's job but a reader's.

## Documents have tiers

Sorted by **when they are read**, because that is what they cost. A document read on every cold
start is paid for on every cold start, whether or not it says anything the session will act on.

- **Tier 1 — `docs/STATE.md`.** The only document read on arrival: the wave, what is in flight, the
  questions that block something and what they block, the debts with the date each was first
  recorded, and two or three next candidates. Rewritten from scratch by `/session-end`, never
  appended to. Budget 60 lines, enforced by `pnpm docs:check`.
- **Tier 2 — read once a task is chosen.** `docs/ROADMAP.md` (the map: Now / Next / Later, plus the
  last three sessions), the specs, the ADRs, `docs/CONTRIBUTING.md`.
- **Tier 3 — read on request only.** `docs/history/` and `docs/journal/`. They answer "why is this
  like it is", never "what should I do now".

The failure this replaced is worth keeping in view, because it was nobody's mistake: `ROADMAP.md`
called itself the map and had become 435 lines of which 350 were a changelog, one appended section
per session. Every individual append was correct. The cost landed on every reader afterwards.
`docs:check` now holds the sizes, and `/session-end` holds the judgement — when a section ages out
of the ROADMAP, each lesson in it is asked whether a gate, a rule here, or the DoD now carries it.
A lesson carried by nothing was never protecting anything, and archiving is where that stops being
invisible.

## Where to look next

- `apps/console/CLAUDE.md` — console feature anatomy, routing, Tailwind tokens, role guards.
- `supabase/CLAUDE.md` — migrations, RLS, grants.
- `docs/CONTRIBUTING.md` — ownership zones, git workflow, review policy, spec tiers, GDPR rule,
  the assistant protocol. Read this before your first PR.
- `docs/specs/admin-console.md` — the console's plan: screens, metadata, audit, law monitoring,
  the backlog, and the questions still open.
- `docs/specs/console-feature-dod.md` — what "done" means for a console feature, and how to write
  acceptance criteria. `apps/console/src/features/services` is the reference it describes.
