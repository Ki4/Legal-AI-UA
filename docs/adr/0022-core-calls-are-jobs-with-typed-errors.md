# ADR-0022: A core call is a job, and a failure is a typed envelope

- Status: accepted
- Date: 2026-08-28

## Context

ADR-0021 settled the contract's _language_ — plain JSON Schema, hand-written TypeScript, bridge
tests — and deferred the envelope in one sentence: `schema/operations.json` "arrives with the job
protocol, not with this ADR". This is that protocol, and it had two open questions that no amount of
schema work answers: whether a call is answered synchronously or accepted as a job and polled, and
what a failure looks like on the wire.

Both are frozen before `apps/core` exists, for the reason the trace was: the console is built
against them, and they are what makes handing the core to a second developer possible.

## Decision

### 1. A call is accepted as a job, and the job is polled

`startGeneration` returns the job it created — `202`, status `queued` — and `getGenerationJob`
returns the same object again until it reaches `succeeded` or `failed`.

**The wall-clock limit decides this, not taste.** The only path to the core is a Supabase Edge
Function gateway (ADR-0004), which says in as many words that generation "can run long, while
Supabase Edge Functions have wall-clock execution limits" and that this is why the gateway is not
the pipeline's home. A synchronous call inherits that limit at exactly the moment it matters: it
works against every fixture, every mock and every short document, and fails on the first real one.
A protocol whose failure mode is invisible until production is not a protocol that was chosen.

Two shapes, not three. The hybrid — synchronous for cheap operations, jobs for generation — was the
honest-looking option and is rejected: it doubles the response shapes a caller handles, and the flag
saying which is which is a fact stated in `operations.json` and again in every call site. There is
one cheap operation today and it is the poll, which is already the job's own shape.

**What follows from it, and is deliberately not decided here.** Poll interval and backoff are the
caller's, and land with the gateway (ADM-5) where retries and the audit write already live. Whether
`startGeneration` is idempotent, and on what key, is the same question as what the gateway does when
a lawyer double-clicks — also ADM-5's. Cancellation has no operation, so `JobStatus` has no
`cancelled`: a status nothing can produce is a branch every consumer writes and no fixture reaches.

### 2. A failure is `{ "error": { "code", "message" } }`, and the HTTP status stays

`code` is a closed set of five, bridged to TypeScript exactly like `BlockTrust` — which is what makes
it the one part of an error a caller may branch on. `message` is English, for a log and the audit
record, and is never rendered: every user-visible string is a dictionary key (ADR-0006), and a
sentence written by a Python service is in neither locale and cannot be made to be.

**RFC 9457 `application/problem+json` was the alternative with a standard behind it.** Its `type` is
a URI rather than an enum, so there is nothing for a bridge test to grip: a closed set of codes would
have to be layered on top of it, at which point the standard is carried for its field names alone.

**An always-`200` body carrying a result union was the other.** It puts every outcome in one place,
which is genuinely nice for a TypeScript consumer, and it throws away the fact that the transport
already knows: retries, caches, and the gateway's own logs read status codes and would see a
successful call. The console's `api/` layer is where an envelope becomes a view model anyway, so the
convenience is bought where it is cheapest to lose.

**No `details` bag.** It is where a validation error's offending value ends up, and a generation
request's values are client answers — the same argument that keeps arguments out of `ToolCall`, plus
`docs/CONTRIBUTING.md`'s rule that the stricter reading wins until the question is explicitly
resolved. **No `retriable` flag** either, for the opposite reason: it is derivable from `code`, and
two representations of one fact is what this repository refuses everywhere else.

**A call that fails is an exception; a job that fails is a return value.** `CoreCallError` carries
the code. `getGenerationJob` returns a `failed` job normally, because a caller polling a job wants
the failed job — that is the answer to its question, not a failure to answer it.

### 3. `Job` is flat, and its invariants live in a test

A union tagged by `status` is the more precise model and it is the shape ADR-0021 §3 names as where
the key bridges stop working: the key set stops being constant, so the assertion that TypeScript and
the schema list the same properties has nothing left to assert. So `Job` is one closed object with
nullable fields, and the four invariants a union would have carried — a result exactly when it
succeeded, an error exactly when it failed, a start exactly when it left the queue, a finish exactly
when it is terminal — are asserted against the fixtures in `protocol.test.ts` and named in
`packages/core-client/README.md` as something the contract cannot prove about itself.

### 4. `operations.json` is the envelope, and it is checked

Each `operationId` maps to its method, path, request, success response and error codes, with `$ref`s
into the schemas. A test asserts that its operation set equals `CoreClient`'s keys, that every `$ref`
resolves through ajv's registry, that every error code has exactly one home — an HTTP answer or a
job's `error`, never both and never neither — and that `startGeneration` answers `202`.

That last one is this ADR made falsifiable: the decision in section 1 is not a paragraph somebody
has to remember, it is a line a test fails on.

## Consequences

- **The console can be built against a protocol that does not exist yet**, and the fifth pass — the
  fixture client — has a shape to implement rather than a shape to invent.
- **ADR-0021 §1's debt is paid.** The envelope has a home outside TypeScript and, unlike a committed
  OpenAPI document, something that reads it back.
- **Polling is a cost the gateway pays.** Two hops become two hops plus _n_ polls, and how often is
  ADM-5's to decide. Server-sent events or a webhook would remove them and are what to revisit if
  the poll traffic ever shows up as a number rather than a worry.
- **Eight more drift cases exist and are executable**, added to `scripts/probes.mjs` rather than
  written into a PR description. Two of the twelve run for this pass were typecheck-only and stayed
  manual, because `pnpm probes` ran Vitest and a case only `tsc` can see is one it could not make.
  Amended 2026-08-28: a probe may now name a package instead of a test file and be watched by that
  package's `tsc`, so all twelve are probes. The gap `README.md`'s table names is a gap between two
  checkers, not a gap in what can be probed.
- **The generation request carries two pointers and no answers.** The answers table (ADM-64) does
  not exist, and a shape guessed for it now is the mistake the trace's own README records twice.
  Adding the payload later is a `protocol_version` bump.

See `docs/adr/0021-core-contract-is-json-schema-with-bridge-tests.md` for the contract's language and
the bridge argument, `docs/adr/0004-ai-core-separate-service.md` for the gateway and its wall-clock
limit, and `packages/core-client/README.md` for how to add an operation.
