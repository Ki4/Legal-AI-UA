# ADR-0021: The core contract is JSON Schema, and drift is closed by bridge tests

- Status: accepted
- Date: 2026-08-27

## Context

ADR-0016 decided the core is Python and fixed one thing about the contract: **neither language's
type system is the authority.** It deferred the rest in one sentence — "Which schema language, and
whether the TypeScript is generated or hand-written against it, is ADM-3's to settle". This is that
settlement.

The thing being contracted is the generation trace and the calls that produce it: a per-block record
of what produced each block and why (`docs/VISION.md` "Document anatomy"), crossing from a Python
service through a Deno edge-function gateway (ADR-0004) into a TypeScript console. It is frozen
before the generator exists, because frontend work proceeds against it and because it is the
artifact that makes handing `apps/core` to a second developer possible.

A placeholder already exists — `packages/db/src/types.ts` and `mockTrace` beside it — with a comment
saying it lives there because it crosses the gateway. This ADR is what gives it a home.

## Decision

### 1. Plain JSON Schema 2020-12, one file per concept

`packages/core-client/schema/*.schema.json`. **Not OpenAPI**, which was the first instinct because
the HTTP envelope must not live only in TypeScript. Three things decided against it.

**ajv runs default-strict on plain JSON Schema and does not on an OpenAPI document.** The document's
own keywords (`openapi`, `info`, `paths`) must be whitelisted, and the usual shortcut for that —
`strict: false` — switches off the check that catches a misspelled `additionalProperies: false`.
That keyword is what the whole drift argument in section 3 rests on, so the shortcut would disable
the load-bearing check in exchange for convenience. `example` and `discriminator` also throw inside
`components.schemas` under strict, so it would be OpenAPI without OpenAPI's own annotations.

**FastAPI produces OpenAPI; it does not consume it.** Hand-writing a document to feed a future
Python service means writing the document, then the models, then a check that they agree. Plain JSON
Schema is read directly by the Python generators, and once `apps/core` exists the real envelope
check runs the other way: diff the service's emitted `/openapi.json` against what is committed here.
The derived artifact is the one that gets checked; the hand-written one stays frozen.

**We run no OpenAPI tooling at all** — no codegen, no Swagger UI, no server. Adopting a standard
whose tooling is declined buys its constraints and none of its payoff.

The envelope still gets a home rather than living in TypeScript: `schema/operations.json` maps each
`operationId` to its method, path, request, responses and errors with `$ref`s into the schemas, and
a test asserts that its operation set equals the `CoreClient` interface's keys and that every `$ref`
resolves. That is what OpenAPI was wanted for, delivered and **checked** — which a committed OpenAPI
document never was. It arrives with the job protocol, not with this ADR.

JSON rather than YAML: no parser dependency, and Prettier already formats `*.json` through
lint-staged.

### 2. Reasoning goes in the ADR and the README, not in `description`

JSON carries no comments and this repository explains itself heavily. The temptation is to push that
into schema `description` fields. Do not: `description` is consumer-facing semantics that ends up on
the wire, in generated Python docstrings and in any published docs. Repo-internal reasoning — why
absence is `null` rather than an absent key, why a field was considered and not added — belongs here
and in `packages/core-client/README.md`.

### 3. TypeScript is hand-written, and drift is closed by bridge tests

No codegen, and no generated file checked in. `packages/law-refs` already holds nothing generated,
deliberately, and a build step for one package is paid on every run of the task graph.

**The argument that does not work, recorded because it is convincing and wrong.** If every schema
object sets `additionalProperties: false`, lists every property in `required`, and the house style
forbids optional `?` properties, then the key set of every valid value is constant — so validating
one typed fixture proves the schema and the TypeScript agree. That is true **for key sets, and
nothing else**. `tsc` proves `fixture ∈ Type`; ajv proves `fixture ∈ Schema`; neither proves
`Schema ≡ Type`.

Where it leaks, concretely. Let the schema say `enum: ["template", "ai_generated"]` while TypeScript
says `"template" | "ai_generated" | "lawyer_edited"`, and let every fixture use `"template"`. Both
sides pass. Reverse it — the schema gains a value the TypeScript lacks — and it is worse: no fixture
can carry the new value, because `tsc` rejects it, so nothing is able to fail. Then the core sends
it and `AnatomyPage`'s `Record<BlockTrust, ProvenanceState>` yields `undefined` into a component.
Key-set invariance also fails for `kind`-tagged unions, and an array that is `[]` in every fixture is
never exercised at all.

**So closed sets are bridged through a runtime constant**, reusing the pattern already at
`packages/db/src/types.ts` (`AUDITED_TABLES`):

```ts
export const BLOCK_TRUST = ["template", "ai_generated", "lawyer_edited"] as const;
export type BlockTrust = (typeof BLOCK_TRUST)[number];
// and in the test: the schema's `enum` must equal BLOCK_TRUST, as a set.
```

The same for property names: a `*_KEYS` array declared `as const satisfies readonly (keyof T)[]`, a
type-level assertion that it misses no key of `T`, and a test that the schema's `properties` and
`required` both equal it. TypeScript holds one end, ajv the other, and the constant is the bridge.

Three supporting rules:

- **A coverage assertion.** Every named schema must appear in the registry of exercised fixtures.
  An unexercised type fails rather than passes silently.
- **Negative fixtures per constraint, not per type** — the both-halves rule in the root `CLAUDE.md`.
  A checker that flags everything and one that flags nothing are equally useless.
- **Validate `JSON.parse(JSON.stringify(x))`.** ajv treats `{ a: undefined }` as missing for
  `required` but present for `additionalProperties`, and a `Date` fails `type: "string"` even though
  serialising would have made it one. The wire is JSON, so the test validates JSON.

ajv runs with its **default strict mode and no configuration at all** — which is the practical
dividend of choosing plain JSON Schema in section 1. Against an OpenAPI document the same call needs
either `strict: false` or a vocabulary whitelist for `openapi`, `info` and `paths`; here there is
nothing to whitelist, so the mode that catches a misspelled keyword is simply the mode it is already
in, rather than something a future reader could switch off for a quiet afternoon.

No `format: "date-time"` either: it throws without `ajv-formats`, and with it still accepts `+03:00`
offsets, so ISO instants are pinned by a `Z`-anchored `pattern` instead — which is what ADR-0012's
convention 2 actually asks for. That constraint arrives with the first timestamp field; the trace
has none yet.

### 4. Fixtures are JSON files, not TypeScript objects

`packages/core-client/fixtures/*.json`. ajv validates them against the schemas, and the Python lane
will validate **the same files** against its own models.

This is ADR-0016's own argument turned on itself: "a type that is only checked on one side of a
serialisation boundary is checked on neither." A fixture written as a TypeScript object is
unreadable by the Python lane, so it would be checked on one side only.

Note what this does **not** claim. A JSON file read at runtime is not type-checked by `tsc`, and
importing it instead would not help: TypeScript widens `1` to `number` and `"template"` to `string`
on a JSON import, so `satisfies GenerationTrace` fails on exactly the literal-typed fields that
matter. The fixtures therefore prove that the **schema** accepts real wire data; they are not what
proves the TypeScript agrees with it. The bridges in section 3 are. The remaining direction — that
a value TypeScript accepts is one the schema accepts too — is covered by a small typed sample
declared inline in the test with `satisfies` and validated after `JSON.stringify`.

### 5. `packages/db` holds what Postgres produces; `packages/core-client` holds what the core produces

That is the rule the placeholder's move follows. It also answers where the next such type goes
without anybody having to ask.

### 6. snake_case on the wire

`packages/db/src/types.ts` says `needsAttention`; ADR-0016 and `docs/ROADMAP.md` say
`needs_attention`. The repository already contradicts itself, so the generator would pick by
accident. It is **snake_case**: Python-native, and consistent with `apps/console/CLAUDE.md`'s
existing rule that rows are snake_case and view models camelCase — the trace is what another system
produces, not a view model. It also gives `features/anatomy`'s `api/` layer a real mapper instead of
the identity copy its own file apologises for.

### 7. No MSW, for now

ADR-0004 and `docs/ROADMAP.md` both say "typed HTTP contract + MSW mocks". **This overrules that
wording**, the way ADR-0020 overruled the spec's zone line. The package ships a `CoreClient`
interface and a fixture implementation typed as it, matching the house style in
`apps/console/src/shared/api/fixture-store.ts`.

MSW intercepts HTTP. There is no HTTP client to intercept until the gateway exists (ADM-5), and a
mock server standing in front of no client is machinery guarding nothing. Revisit when ADM-5 lands
and there is real `fetch` code whose behaviour a test needs to pin.

### 8. The Deno constraint is honoured, but its checker is deferred

The gateway is a Deno edge function and will import this package, so schema and fixture JSON are
read **only from `*.test.ts`**, through `readFileSync(new URL(...))`. Deno 2 hard-fails a bare
`.json` import without `with { type: "json" }`, so a plain import anywhere on `src/index.ts`'s
transitive graph would make the package unimportable from the gateway.

A script enforcing that is **not** written yet. `supabase/functions/` does not exist, there is no
`deno.json` or import map anywhere in the repository, and ADR-0020's "Deno reads `packages/law-refs`
unchanged" has zero instances — it is an intention, not a verified fact, and this repository's own
verification rule says so. A gate written for an unbuilt consumer whose shape nobody has confirmed
is a guess with a green tick on it. It lands with ADM-5, next to the first real Deno import.

## Consequences

- **The contract is reviewable by somebody who did not write it**, which is what ROADMAP asked of
  it. One file per concept, and the reasoning in prose beside them rather than inside them.
- **Drift becomes a test failure instead of a code review.** The cost is roughly ten lines of bridge
  per closed set, paid once per schema object.
- **The gate is `pnpm test` _and_ `pnpm typecheck`, and knowing which catches what is part of it.**
  Vitest transpiles types away without checking them, so the exhaustiveness assertions are inert
  under the test runner and fire only under `tsc`. Verified by hand on the way in: a value added to
  the schema's enum alone, a value added to the TypeScript union alone, and a property added to the
  schema alone are all caught by `pnpm test`; **a property added to the interface alone is caught
  only by `pnpm typecheck`**. Trusting the test runner on its own would leave that fourth case
  silent, which is the failure shape this whole design exists to avoid.
- **Hand-written TypeScript can still drift in ways no bridge covers** — a `pattern` loosened, a
  numeric bound changed. Those are not expressible in TypeScript at all, so no arrangement short of
  runtime parsing would catch them. Named rather than hidden.
- **A third hand-kept copy of `public.law_source` is coming.** `packages/law-refs` already confesses
  to the second. The bridge tests cover schema-to-TypeScript; Postgres-to-TypeScript stays manual,
  as it was.
- **`ajv` is a devDependency of one package and never ships.** The package keeps `law-refs`'
  property of having no runtime dependencies, which is what lets the gateway read it later.
- **If a real OpenAPI need appears** — a public API, generated client SDKs, a documentation site —
  this decision is cheap to revisit: JSON Schema 2020-12 is exactly what OpenAPI 3.1 embeds, so the
  schemas move over unchanged and only `operations.json` is rewritten.

See `docs/adr/0016-core-in-python.md` for why the core is Python and why the contract could not lean
on a shared type, `docs/adr/0004-ai-core-separate-service.md` for the gateway, and
`packages/core-client/README.md` for how to add a schema.
