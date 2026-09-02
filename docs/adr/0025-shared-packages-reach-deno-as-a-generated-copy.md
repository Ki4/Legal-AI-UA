# ADR-0025: Shared packages reach Deno as a generated copy, not as a path

- Status: accepted
- Date: 2026-09-02

## Context

ADR-0024 ends with a sentence that turned out to be exactly right and was still not enough:

> **`deno check` is not run by anything.** The import map is exercised the first time somebody runs
> `supabase functions serve` … This is the weakest point of this decision and it is the one to
> revisit first.

That first time was 2026-09-02, three days after the fetcher was written. Docker had been down on
the day it landed, so the function had never executed outside a compiler. The first real request
answered:

```
worker boot error: failed to bootstrap runtime: failed to create the graph:
Module not found "file:///…/packages/law-refs/src/index.ts"
```

The cause is not the import map being wrong. It is right, and four tools agree with it: `tsc`
resolves it through `paths`, Vitest through the workspace symlink, the console through
`@legal-ai/law-refs`, and `deno run` on the host through `deno.json`. The one thing that disagrees is
the thing that runs the code in production. **`supabase functions serve` mounts
`supabase/functions` into the edge-runtime container, read-only, and nothing above it.** A path two
levels up is not a path the worker has.

`docker inspect` on the container is the whole of the evidence:

```
…/Legal-AI-UA/supabase/functions -> /Users/serge/Legal-AI-UA/supabase/functions (ro=true)
```

ADR-0024 considered the obvious repair and rejected it:

> **Vendoring `law-refs` into the functions directory** so Deno needs no import map. That is two
> copies of the one definition ADR-0020 exists to keep single, and the failure it produces is the
> one that section warns about: a norm that never drifts.

The rejection is correct about a **committed** copy. It does not describe a copy that never exists
between commands.

## Decision

**`packages/law-refs` stays where it is.** `apps/console/src/features/law` imports it to normalize a
citation a lawyer pasted, and the console does not run on Deno. The code is shared domain logic,
which is what `packages/` is for; the mount is a constraint of one runtime's tooling and not a claim
about who owns the code. Moving the source under `supabase/` would make the layout state something
false in order to satisfy a container.

**`scripts/sync-edge-shared.mjs` copies its runtime source into `supabase/functions/_shared/`**,
which is git-ignored, and `pnpm functions:serve` and `pnpm functions:deploy` run it first. The import
map points at `./_shared/law-refs/index.ts` — inside the mount.

**The copy is generated and never committed, and that is the whole answer to ADR-0024's objection.**
Two copies drift when both are allowed to persist. This one is deleted and rebuilt on the way into
every command that uses it, so there is no state that can be stale — drift is impossible rather than
detectable. That is a stronger property than the gate a committed copy would have needed, and this
task exists because a gate nobody had run was carrying an untrue claim.

**Only packages a runtime has answered for are on the list.** `core-client` was added ahead of its
first import, on the reasoning that ADR-0020 has the gateway importing it. It carries
`schema-walk.ts`, which opens `node:fs` — absent from the Deno gateway — so the copy would have put a
module that cannot load into a bundle nothing loads yet, to be discovered by whoever first wires the
gateway up. It was removed the same hour. A package joins the list on the day something imports it.

## Consequences

- **A fresh checkout cannot `deno run` a function until the sync has run.** This is the one way back
  into the boot error above, and it is why the wrapper scripts exist rather than a line in a README.
  A bare `supabase functions serve` still fails, and it fails loudly and immediately.
- **ADR-0024's weakest point is narrowed, not closed.** Nothing in CI still runs `deno check`. What
  changed is that the manual step now works, so the first person to run it learns something about
  their code instead of about the mount.
- **`packages/law-refs` being dependency-free is necessary and was never sufficient.** The root
  `CLAUDE.md` says it is dependency-free "because the Deno gateway will import it". True, and the
  other half is that Deno has to be able to see the file. Both halves are now enforced by something:
  the first by the package having no dependencies to install, the second by this script.
- **Revisit when a second function needs a different subset.** One list for one directory is right
  while there is one function; per-function lists are the shape to reach for after that, not before.

## Alternatives considered

- **Moving the source into `supabase/functions/_shared/` and re-exporting from `packages/law-refs`.**
  One source, no copy, no script — and a layout that tells the reader the console's citation parser
  belongs to the edge functions. Rejected on that, not on cost.
- **A committed copy with a drift check**, in the shape of the `core-client` bridge tests. It is the
  familiar pattern here and it is strictly weaker: a gate that must keep being run, protecting
  against a state that need not exist.
- **Publishing `law-refs` to JSR** and importing it by URL. The cleanest thing Deno offers, and it
  turns an internal refactor into a release. Worth revisiting if a second consumer outside this
  repository ever appears.
- **`pnpm` injected workspace dependencies**, so `supabase/functions/node_modules/@legal-ai/law-refs`
  holds real files rather than a symlink out of the mount. It might work; it rests on hard-link
  behaviour across a Windows bind mount and on the edge runtime resolving bare specifiers through
  `node_modules`. Two guesses about other people's tools, where the copy is one fact about ours.
