# ADR-0024: The edge functions are held to the Node lane, not a Deno one

- Status: accepted
- Date: 2026-09-01

## Context

ADR-0020 put the article fetcher in `supabase/functions/` as a Deno edge function. ADM-42 is the
first one written, and it arrives with a question that ADR-0020 did not answer: **what runs its
tests, and what typechecks it.**

The repository has exactly one shape for this today. `pnpm lint`, `pnpm typecheck`, `pnpm test` and
`pnpm probes` run from the root over every workspace package, and ADR-0016 records the one deliberate
exception — `apps/core` is Python and therefore carries its own lint, format and test lane. That
exception was expensive to argue for and is worth exactly one use.

The obvious move is to treat Deno the same way: `deno check`, `deno test`, a fourth CI job. It is
what the Supabase documentation assumes, and it would be wrong here. `apps/core` is a different
_language_ with a different toolchain and a different set of libraries. `supabase/functions/` is
TypeScript, importing the same `packages/law-refs` source the console imports, held to the same
`tsconfig.base.json`. A second runner would buy nothing but a second place for a version to drift.

The counter-argument is real and has to be met rather than waved at: Deno is not Node. Its module
resolution differs, its globals differ, and a file that compiles under `tsc` with `@types/node` in
scope can fail on the first request in production.

## Decision

**`supabase/functions` is a private workspace package** (`@legal-ai/edge-functions`), so the root
`typecheck` and the root Vitest reach it like anything else.

**Its decisions live in modules over injected dependencies**, and `index.ts` holds only wiring — a
real `fetch`, a real clock, a real Supabase client. `read.ts` and `handler.ts` are what the tests
assert; `Deno.serve` is not something a unit test should pretend to reach.

**Two tsconfig projects, and the split is the enforcement of the counter-argument above.**
`tsconfig.json` compiles the function sources with `"types": []` — no `@types/node`, so an
`import … from "node:fs"` is a compile error in a file that would have failed at runtime.
`tsconfig.test.json` compiles the tests with `"types": ["node"]`, because they legitimately read
fixtures off disk. Both run in the package's `typecheck` script.

**Deno's own resolution is described once, in `supabase/functions/deno.json`**, whose import map
points `@legal-ai/law-refs` at the same source file the tsconfig `paths` entry does. One specifier in
the files, two resolvers behind it.

**The live test is opt-in.** `live.test.ts` reaches zakon.rada.gov.ua and is skipped unless
`LAW_LIVE=1`. It is the cheap half of §9.15 condition 4, and it stays out of CI because a pull
request going red for a slow government website is a gate people learn to ignore.

## Consequences

- **One command still runs everything.** `pnpm test` covers the fetcher's decisions; `pnpm probes`
  can break a line of it and watch the right test object, which is what makes those assertions worth
  anything (six of the new probes do exactly that).
- **The Node/Deno gap is narrowed, not closed, and where it is still open is written down.**
  `index.ts` is typechecked and is not covered by any test — deliberately, since what it contains is
  a client, a clock and a global. The honest form of that limit is that it stays small; the day it
  grows a decision, the decision moves into `handler.ts`.
- **`deno check` is not run by anything.** The import map is exercised the first time somebody runs
  `supabase functions serve`, and that is a manual step in `supabase/README.md` rather than a gate.
  This is the weakest point of this decision and it is the one to revisit first — a Deno lane that
  did nothing but `deno check` the functions directory would close it for the price of a container
  in CI. It is not paid for today because there is one function and its imports are two lines.
- **Revisit when there are several functions, or when one needs a Deno-only API.** Both change the
  arithmetic: the first makes an unchecked import map likelier to break, and the second makes
  `deno.d.ts` — four narrow lines today — into a maintained shim of somebody else's runtime.

## Alternatives considered

- **A full Deno lane (`deno check`, `deno test`, a CI job).** Rejected for now on cost, not on
  principle; see the consequence above for the conditions that would change the answer. It also
  cannot run the tests as written, because they read fixtures with `node:fs`.
- **Excluding `index.ts` from TypeScript entirely.** It is the file no test reaches, so leaving it
  uncompiled as well would have left it checked by nothing at all.
- **Vendoring `law-refs` into the functions directory** so Deno needs no import map. That is two
  copies of the one definition ADR-0020 exists to keep single, and the failure it produces is the
  one that section warns about: a norm that never drifts.
  Revisited by ADR-0025 on 2026-09-02, when the import map turned out not to work at all: the
  objection holds against a copy that is committed, and not against one that is regenerated on the
  way into every command and never persists.
