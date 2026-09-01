# ADR-0020: The article fetcher is an edge function, not the core

- Status: accepted
- Date: 2026-08-15

## Context

ADR-0011 decided that the platform watches known articles itself rather than buying a publication
feed. `docs/specs/admin-console.md` §10 assigns that work with one line: "Fetching, normalization and
diffing belong to the core owner's zone; the console owns entry, triage, the calendar and the health
surfaces."

Read literally alongside ADR-0004 and ADR-0016, that line puts the fetcher in `apps/core` — a Python
service reachable only through a Supabase Edge Function gateway. Three of those four things do not
exist: `apps/core`, the gateway (ADM-5) and `packages/core-client` are all unbuilt, and ADM-5 waits
on ADM-3.

So the register (ADM-21) could be built and the watcher could not, because entry-time validation
(ADM-41), the fetched-text confirmation (ADM-42) and fingerprinting (ADM-43) each need a fetch, and
every route to one ran through two unbuilt foundation items.

The line also does not survive contact with what the fetcher actually is. ADR-0004 separates the
**AI core** — the generation pipeline, its prompts, its trace — because it is a different runtime and
a different kind of risk. Fetching an article, normalizing whitespace and hashing the result contains
no model call at all. §9.12 is explicit that AI arrives here later and only to summarise a diff for a
lawyer, and that it "changes none of the mechanics above".

## Decision

**The article fetcher is a Supabase Edge Function** — Deno, TypeScript — under `supabase/functions/`,
called on a schedule and by the console. It is not `apps/core` and it does not go through the
gateway.

**The normalization it shares with the console lives in `packages/law-refs`**: a package with no npm
dependencies, no Node built-ins and explicit `.ts` extensions on its internal imports, so that Deno
can read its source unchanged. That constraint is the reason it is a package of its own rather than
part of `packages/db`, which imports the generated Supabase types.

This overrules §10's zone line for the fetcher specifically. The rest of that line stands: triage,
the calendar and the health surfaces are the console's, and the AI diff classification of §9.12, when
it is built, is core work reached through the gateway like everything else.

## Consequences

- **ADM-41, ADM-42 and ADM-43 stop waiting on ADM-3 and ADM-5.** That is the whole practical point.
  A register of un-normalized links reproduces the pinned-revision trap at scale and its symptom is
  silence (§9.2), so the thing that had to arrive first was the normalization, not the pipeline.
- **One definition of what is watched, enforced by the compiler.** The console and the fetcher import
  the same `normalizeLawLink`, so they cannot disagree about which act a pasted URL means. Two
  implementations would have failed in the worst available way: a norm that never drifts, which looks
  exactly like a norm that has not changed.
- **What runs its tests was still open, and is now closed by ADR-0024**: the functions are a
  workspace package held to the root Node lane, with their decisions in modules over injected
  dependencies so that `pnpm test` and `pnpm probes` reach them.
- **A second runtime, not a second language.** Deno is not Node and its differences are real, but the
  code that crosses the boundary is pure functions over strings. `apps/core` remains the one
  non-TypeScript package (ADR-0016), and the Python lane stays unused until the generator needs it.
- **The safety conditions of §9.15 are unaffected and still ship with the fetcher**: the parser
  asserts what it expects to find, an empty extraction is a failure rather than "no change", fixtures
  run in CI, and a lawyer spot-checks by hand each quarter. Those were the argument for building
  rather than buying, and none of them depends on which runtime executes them.
- **Revisit if the fetcher grows a model call.** The moment classifying a diff moves from a lawyer's
  reading to the core's, the boundary this ADR draws is in the right place and the work crosses it —
  through the gateway, as ADR-0004 requires.

See `docs/specs/admin-console.md` §9 for the mechanism this serves and ADR-0011 for why we build it
at all.
