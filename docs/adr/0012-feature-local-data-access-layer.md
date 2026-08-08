# ADR-0012: Feature-local data access through an `api/` layer

- Status: accepted
- Date: 2026-08-04

## Context

`apps/console/CLAUDE.md` already says components reach data only through their feature's own `api/`
folder. The rule was written at bootstrap and never implemented: no feature has an `api/` folder,
three components import mocks from `@legal-ai/db` directly, and `TeamPage` calls Supabase from
inside a component. The rule exists as prose with no instance to copy.

That matters now for a specific reason. Two developers are about to work on the console in
parallel, and neither can start until the database exists — unless the boundary between "what the
screen shows" and "where the data comes from" is real. With the boundary in place they agree
function signatures on day one, work against fixtures, and the later switch to Supabase touches no
component. Without it they wait, or they each invent a different arrangement and the two halves of
the console stop resembling each other.

Writing the boundary down also settles conventions that are invisible until they are violated: how
money is carried, whether errors are thrown or returned, and — the one that motivated this ADR —
that a write denied by row-level security does not fail.

## Decision

Every feature owns `src/features/<name>/api/`. Components call it and nothing else; they never
import `@legal-ai/db`, `supabase`, or another feature.

The layer is defined by a TypeScript interface — the contract — with implementations satisfying
it. Today a fixture implementation, later a Supabase one; the choice is made in one file.

Six conventions hold across every feature.

**1. `api/` returns view models, not table rows.** The services table shows a title, a status, the
live version number, the assigned lawyer's name and a price — data from three tables. Returning
rows pushes that assembly into each component, where it is repeated and diverges. The layer speaks
the language of the screen.

**2. Formats are decided once.** Timestamps are ISO 8601 strings, never `Date` objects, because
that is what crosses JSON anyway and a half-converted codebase produces `Invalid Date` in
production rather than in review. Money is an integer of minor units plus a currency code, never a
float — `0.1 + 0.2` is not `0.3`, and this product bills real money.

**3. Errors are thrown as one application type with a small closed set of codes.** The UI
distinguishes at least: no rights, invalid input, not found, and the network being down.

The rule this exists for: **a write denied by an RLS `USING` clause is not an error.** Postgres
filters the row out of the statement, so the `UPDATE` matches nothing and Supabase returns an empty
array with `error: null`. A denial caught by `WITH CHECK` raises, a denial caught by `USING` is
silent, and the caller cannot tell which applies. Every mutation therefore checks how many rows it
affected and turns zero into an explicit error. Done in the layer, this is written once; left to
components, it is forgotten in half of them and the interface reports success for writes that
never happened.

**4. Supabase types stop at the boundary.** No `PostgrestError`, no Postgres error codes in a
component. `if (error.code === "42501")` in JSX is unreadable a year later and welds the UI to one
backend.

**5. A mutation returns the updated entity**, so the caller refreshes without a second round trip
and without a window of stale data on screen.

**6. Type placement follows reuse.** Domain vocabulary that both apps need — `ServiceStatus`,
`GenerationMode`, `ReviewMode` — lives in `packages/db`, which will eventually be generated from
the schema. View models exist because one screen renders them and live in that feature's
`api/types.ts`. Putting view models in the shared package turns it into a dumping ground and makes
one screen's needs everyone's rebuild.

`features/services` is the reference implementation. New features copy its shape.

## Consequences

- Frontend work starts before the schema exists. This is the immediate reason the ADR is being
  written now rather than later.
- The signature file becomes the contract between the person writing screens and the person
  writing the schema, and the compiler enforces it rather than a document describing it.
- Screens are testable without a database, since the contract can be satisfied by fixtures.
- Fixtures must be shaped exactly like the eventual real response. A mock whose shape is
  convenient rather than accurate silently invalidates the whole arrangement — components get
  built against the wrong shape and the swap stops being free.
- Cost: an extra file layer and a view model that duplicates parts of the row type. Accepted,
  because the duplication is the boundary doing its job.
- Migration debt, stated rather than hidden: `anatomy`, and `team` still bypass the layer.
  `team` is the more valuable of the two to convert, because it is the only feature with real
  queries and therefore the place where convention 3 first earns its keep.

See `apps/console/CLAUDE.md` for the folder anatomy and `docs/specs/admin-console.md` §12 for why
the parallel split depends on this.
