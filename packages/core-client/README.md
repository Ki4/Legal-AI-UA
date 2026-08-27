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
5. **Test.** Add the enum comparison, the two key comparisons, the `additionalProperties` check, and
   the `satisfies FooKeysAreExhaustive` line. `schema.test.ts` has the pattern for each.

## Verifying the mechanism

`pnpm test` and `pnpm typecheck` are **both** part of the gate, and which one catches what is worth
knowing. Vitest transpiles types away without checking them, so the exhaustiveness assertions are
inert under the test runner:

| Change made in isolation              | Caught by        |
| ------------------------------------- | ---------------- |
| a value added to the schema's `enum`  | `pnpm test`      |
| a value added to the TypeScript union | `pnpm test`      |
| a property added to the schema        | `pnpm test`      |
| a property added to the interface     | `pnpm typecheck` |

Run all four by hand when the bridges change. A bridge nobody has watched fail is a bridge nobody
has evidence for — which is the repository's verification rule (`docs/CONTRIBUTING.md`) applied to
this package's own safety net.
