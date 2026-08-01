# ADR-0001: Monorepo with pnpm + Turborepo

- Status: accepted
- Date: 2026-07-30

## Context

The platform will ship at least two applications (a lawyer/admin console and a future public
client-facing web app) that share a design system, database types, and an AI-core client
contract. The team is three people, one of them (the PO) a learning developer, working together
for the first time. We need a repository structure that keeps shared code written once and
keeps the apps from drifting out of sync with each other and with the database schema.

## Decision

Use a single monorepo managed with pnpm workspaces and Turborepo. Shared packages
(`packages/config`, `packages/ui`, `packages/db`, `packages/i18n`, `packages/core-client`) are
written once and consumed by both apps. Turborepo drives the task graph (build, typecheck, lint,
dev) and its caching; the task graph — knowing that `apps/console` depends on `packages/db`
which must build first — matters more at this size than the caching speedup does.

A polyrepo (separate repos per app/package) was considered and rejected: at three people, the
coordination overhead of versioning and publishing internal packages outweighs any isolation
benefit, and a first-time team benefits more from a single source of truth than from hard
repository boundaries.

## Consequences

- Design system and DB types have exactly one definition; no version-skew between apps.
- No contract drift: a breaking change to `packages/db` or `packages/core-client` is caught by
  the same `pnpm typecheck` run that would otherwise only surface at runtime in a separate repo.
- Trade-off: a single repo means a single CI pipeline and a single set of local hooks for
  everyone, even for changes scoped to one app — this is accepted as a reasonable cost at this
  team size.
- Trade-off: as the codebase grows, Turborepo's caching benefits become more relevant than they
  are today; if build times become painful, revisit caching configuration rather than the
  monorepo decision itself.
