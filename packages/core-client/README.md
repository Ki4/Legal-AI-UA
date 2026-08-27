# @legal-ai/core-client

The contract with the AI core: what crosses the gateway, and in what shape.

The core is a separately-deployed Python service reached only through a Supabase Edge Function
gateway (ADR-0004, ADR-0016). Three runtimes have to agree about one payload — Python writes it,
Deno relays it, the browser renders it — so the authority is `schema/*.schema.json` and every
language's types conform to it rather than defining it.

`docs/adr/0021-core-contract-is-json-schema-with-bridge-tests.md` has the reasoning. This file has
the mechanics.

## Layout

```
schema/     the authority. Plain JSON Schema 2020-12, one file per concept.
fixtures/   JSON, not TypeScript — the Python lane will validate the same files.
src/        TypeScript that conforms to the schema, plus the bridges that prove it.
```

## Rules that are not obvious

**Nothing in `src/` may import a `.json` file.** The Deno gateway will import this package's source
unchanged, and Deno 2 rejects a bare JSON import without `with { type: "json" }`. Schema and fixture
files are read from `*.test.ts` with `readFileSync`, which is not on `index.ts`'s graph. The same
rule is why the package has no runtime dependencies at all — `ajv` is a devDependency and never
ships.

**Absence is `| null`, never an optional `?` property.** An optional key makes the key set variable,
and the bridges below are an assertion that it is not.

**snake_case on the wire.** This is what another system produces, not a view model. The console's
`api/` layer converts to camelCase, which is where that conversion belongs.

**Reasoning does not go in `description`.** Those strings end up on the wire, in generated Python
docstrings and in any published docs. Consumer-facing semantics only; the "why" goes in the ADR or
here.

## The trace's field list, and what it leaves out

The list is frozen against `docs/VISION.md`'s "Document anatomy", which names six things a block
records. All six are in the schema. What follows is the part that does not fit in a `description`.

**Law references are a register plus pointers, not inline copies.** The trace carries every cited
norm once in `law_refs`, and a block cites by `norm_id`. Four blocks citing article 112 would
otherwise carry four copies of it, and nothing in a schema can stop two of those copies disagreeing
— an object the schema cannot say is wrong is worse than an id it cannot say resolves, because the
second at least renders visibly oddly. This mirrors `public.law_norms`, which is watched once and
depended on many times (spec §9.3).

**Each `LawRef` is both a pointer and a snapshot, and it has to be both.** A live screen follows
`norm_id` into the register to ask "has this changed since?". But a trace is archived in the issued
document's passport (spec §5.3) and read years later, by which time the register row may have been
re-scoped, re-titled or dropped — so the reading at generation time travels with it. `relied_on`
travels too: when a diff arrives in six months that sentence is the whole of what tells a reader
whether the change matters, and by then the join may no longer resolve.

**There is no `scope` field.** `public.law_norms` has one, constrained so that `article is not null`
exactly when the scope is an article. Carrying both here would be two representations of one fact,
which that migration's own comments refuse except for a generated column that cannot drift. So
`article === null` _is_ act scope.

**Tool calls carry no arguments and no results.** A tool call's arguments carry client answers, and
spec §5.5 and §6.4 say keys only, never values. `docs/CONTRIBUTING.md` settles which reading wins
when a rule is arguable — the stricter one, until the question is explicitly resolved — so the
schema gives personal data nowhere to sit rather than trusting the core to leave it out. Adding a
redacted-arguments field later is a version bump; removing one that leaked is an incident.

**A condition is text plus the field keys it read, not a syntax tree.** The condition editor
(ADM-16) and the template schema (ADM-1) do not exist, so an AST frozen here would be a guess about
decisions nobody has made — which is the mistake ADR-0021's journal records for law references,
nearly frozen as a triple that could not express act scope. The field keys are carried rather than
parsed back out of the expression, because parsing them back out means an expression parser in the
console: a second implementation of the template language, in the wrong zone.

**`trace_version` stays at 1 through this freeze.** It exists so a trace archived years ago can
still be read, and no trace has ever been archived — `apps/core` does not exist. Bumping it would
claim a version 1 is out there that some reader might meet. It moves the first time the shape
changes after something has emitted it.

**What the contract cannot prove about itself**, named here rather than left to be discovered:

- **That a `law_ref_id` resolves.** JSON Schema has no cross-reference constraint. `schema.test.ts`
  asserts it for the fixtures; the console's `api/` layer decides what a dangling id renders as (as
  itself, visibly odd — dropping it would tell a lawyer the block rests on nothing).
- **That a `pattern` still means what it meant.** A loosened regex or a changed numeric bound is not
  expressible in TypeScript, so no bridge covers it. ADR-0021 names this too.

## Adding a type

The hand-written TypeScript can drift from the schema it claims to follow, and the drift is silent —
a value the schema allows and the union does not produces `undefined` at a lookup rather than an
error. So every type arrives with its bridges. For a new type `Foo`:

1. **Schema.** Add it to a `schema/*.schema.json`, with `additionalProperties: false` and every
   property listed in `required`.
2. **TypeScript.** Declare closed sets as an array first, and derive the union from it:

   ```ts
   export const FOO_KIND = ["a", "b"] as const;
   export type FooKind = (typeof FOO_KIND)[number];
   ```

3. **Key bridge.** Add `FOO_KEYS` as `as const satisfies readonly (keyof Foo)[]`, and the
   `FooKeysAreExhaustive` type beside it that is `never` when a key is missing.
4. **Fixtures.** Extend `*.valid.json` so the new type is reached, and add a case per constraint to
   `*.invalid.json`. A constraint with no failing case is a claim nothing checks.
5. **Test.** Add the enum comparison, the two key comparisons, and the exhaustiveness line.
   `schema.test.ts` has the pattern for each. The `additionalProperties` check and the `$defs`
   listing already walk every object `$def`, so a new one arriving open — or arriving unexercised —
   fails without anything being added.

Three of the coverage assertions in `schema.test.ts` will also go red on their own, and each names
what it wants: a nullable field whose fixtures are all null (or none of them), an array that is `[]`
everywhere, and a constraint keyword with no case in `*.invalid.json`. **That last one counts by
exclusion** — anything that is not a known structural or annotation keyword is treated as a
constraint — because the first draft counted by inclusion and stayed green when `maxLength` was
added. A gate that can only see the constraints somebody already thought of is guarding the wrong
set.

## Verifying the mechanism

`pnpm test` and `pnpm typecheck` are **both** part of the gate, and which one catches what is worth
knowing. Vitest transpiles types away without checking them, so the exhaustiveness assertions are
inert under the test runner:

| Change made in isolation           | Caught by        |
| ---------------------------------- | ---------------- |
| a value added to a schema `enum`   | `pnpm test`      |
| a value added to a bridge constant | `pnpm test`      |
| a property added to the schema     | `pnpm test`      |
| a property added to the interface  | `pnpm typecheck` |

Run all four by hand when the bridges change. A bridge nobody has watched fail is a bridge nobody
has evidence for — which is the repository's verification rule (`docs/CONTRIBUTING.md`) applied to
this package's own safety net. The four were re-run on 2026-08-28 against the frozen field list, on
`ToolOutcome` and `LawRef` rather than `BlockTrust` and `TraceBlock`, and the table held: the fourth
row is still the one `pnpm test` sleeps through.

Seven more were run the same way against the coverage assertions, and every one went red: a
constraint keyword with no failing case, a failing case deleted, a block citing a norm the register
does not carry, a register entry no block cites, every law ref given an article so act scope is
never exercised, every instant given milliseconds so the optional branch never is, and a `$def`
nothing lists.
