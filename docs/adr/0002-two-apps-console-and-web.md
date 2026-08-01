# ADR-0002: Two apps — console and web

- Status: accepted
- Date: 2026-07-30

## Context

The platform has two distinct audiences: lawyers/admins operating internally, and clients
ordering documents publicly. These have different rendering needs (the client-facing surface
needs SEO and public discoverability; the internal console does not) and different complexity
budgets for the team members who own them.

## Decision

Build two separate applications:

- `apps/console` — a Vite + React SPA. Already exists; used by lawyers and admins for
  registration, approval, service management, and document review. Owned primarily by the
  design-system owner, alongside `packages/ui`.
- `apps/web` — a Next.js app, planned for the future. Public-facing, serves clients, needs SEO.

The boundary between the two apps matches the boundary between ownership zones and between
rendering models — it is not an arbitrary split. `apps/console` deliberately stays a plain SPA —
building console screens should not also require App Router server-component knowledge;
`apps/web` takes on that complexity only where SEO actually requires it. Shared configuration (TypeScript base config, ESLint, Prettier) lives once in
`packages/config` so the cost of maintaining two toolchains is paid once, not twice.

## Consequences

- Console and web can evolve independently without one app's rendering constraints leaking into
  the other.
- The console's complexity budget stays scoped to SPA patterns; Next.js/App Router
  complexity is deferred to when `apps/web` is actually built.
- Two apps mean two build/deploy pipelines and two places to keep environment configuration
  consistent — mitigated by `packages/config`, but not eliminated.
- Any UI component intended for both apps must be written framework-agnostically enough to work
  in both a Vite SPA and a Next.js app; this constrains `packages/ui` from the start.
