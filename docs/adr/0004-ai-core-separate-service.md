# ADR-0004: AI core as a separate, in-repo service behind an Edge Function gateway

- Status: accepted
- Date: 2026-07-30

## Context

Document generation (questionnaire interpretation, template filling, block assembly, full
generation, building the generation trace) is a distinct concern owned by the core developer,
with a different runtime profile than a typical CRUD request — generation can run long, while
Supabase Edge Functions have wall-clock execution limits. The frontend must never reach the AI
core directly, since every call needs auth verification, a rights check, and an audit trail.

## Decision

The AI core is an in-repo, separately-deployed service (future `apps/core`), owned by the core
developer, exposed through an HTTP contract typed in `packages/core-client` with MSW mocks so
frontend work can proceed before the core exists. **The MSW half was overruled on 2026-08-27 by
ADR-0021:** there is no HTTP client to intercept until the gateway exists (ADM-5), so the package
ships a `CoreClient` interface and a fixture implementation instead. Revisit when ADM-5 lands.

The frontend never calls the core directly. Every call goes through a Supabase Edge Function
that verifies the JWT, checks rights, writes an audit record, and only then calls the core. Edge
Functions are a **gateway**, not the pipeline's home — they authorize and audit, they don't run
generation, because their wall-clock limits make them unsuitable for a potentially long-running
pipeline.

Open question, deliberately not settled here: TypeScript vs. Python for the core. **Settled on
2026-08-13 by ADR-0016: Python.**

## Consequences

- The core deploys, scales, and iterates independently of the two frontend apps.
- The typed contract plus its mocks — MSW as written here, a fixture implementation since ADR-0021 —
  lets frontend work proceed against a stable interface before the core is fully built.
- Every generation call is authenticated, authorized, and audited before reaching the core.
- Two hops (frontend → Edge Function → core) add latency and a second failure surface versus a
  direct call.
- The TS-vs-Python choice remains open and will shape `packages/core-client`'s contract style
  and available observability tooling once made — this ADR does not resolve it. ADR-0016 does:
  the core is Python, and the contract is a schema rather than a type either side owns.
