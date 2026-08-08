# apps/console — context

Lawyer/admin cabinet. Read the root `CLAUDE.md` first.

## Feature folder anatomy

```
src/features/<name>/
  components/   feature-local UI
  api/          data access — see the anatomy below
  hooks/        feature-local hooks
  index.tsx     exports the feature's RouteObject[]
```

Rules:

- A feature imports only from `packages/*` and `src/app/`/`shared/`. Never from a sibling
  feature — if two features need the same thing, it belongs in a package.
- All data access goes through the feature's own `api/` layer. Components call `api/`, never
  Supabase or `@legal-ai/db` directly — that's what lets mocks become live queries without
  touching a single component.

## The `api/` layer

**`src/features/services/api/` is the reference. Copy its shape.** The conventions and the
reasoning are ADR-0012; the checkable form — what "done" means for any feature, and how to write
acceptance criteria for one — is `docs/specs/console-feature-dod.md`. What follows is the short
version.

```
api/
  types.ts             view models — what the screen renders, not what a table holds
  contract.ts          the interface both sides agree on before either writes code
  <name>.mock.ts       fixture implementation, typed as the contract
  index.ts             the swap point: one line picks the implementation
```

Six conventions, all enforced in the reference:

1. **Return view models, not rows.** `ServiceListItem` carries the lawyer's name and the live
   version — three tables joined once here rather than in every component.
2. **Timestamps are ISO strings, money is integer minor units plus a currency code.** Never a
   `Date` object across the boundary, never a float for money.
3. **Errors are `AppError` from `src/shared/api/errors.ts`,** with a small closed set of codes.
   Every mutation runs its result through `expectOne` — a write denied by an RLS `USING` clause
   returns an empty array with no error, so the row count is the only signal that nothing was
   written.
4. **No Supabase type crosses the boundary.** No `PostgrestError`, no Postgres error codes in a
   component.
5. **A mutation returns the updated entity**, so the caller refreshes without a second round trip.
6. **Shared domain vocabulary lives in `packages/db`; view models live in the feature.**

Still to migrate, and deliberately listed rather than hidden: `anatomy` and `team` bypass the
layer. `team` is the more valuable of the two, being the only feature with real queries.

## `src/app/routes.tsx` — the one shared file

`routes.tsx` is the only file parallel feature tracks both touch. A feature contributes exactly
one import and one spread of its `RouteObject[]` — nothing else moves into this file. See the
comment at the top of `routes.tsx` and the `servicesRoutes` / `teamRoutes` examples.

## Tailwind: semantic tokens only

Use only the tokens defined in `@legal-ai/ui/tokens.css` (see `docs/design/design-system.md`,
live gallery at `/design`): surfaces `bg-canvas` / `bg-paper` / `bg-paperAlt`; borders
`border-line` / `border-lineStrong`; text `text-ink` / `text-inkSoft` / `text-inkMute`; the
single accent `bg-brand` / `text-brand`; status colors (`ok | warn | danger`) applied ONLY via
the `Badge` tone prop or the health mapping — never hand-written in markup. Radii via
`rounded-card` / `rounded-btn`; durations via `--motion-*`; z-index via the `--z-*` scale. No hex
values, no raw Tailwind palette classes, no raw durations. The theme flips via
`<html data-theme="dark">` — a component never references the theme.

## Role guards

Roles come from the JWT `app_metadata` only, surfaced through `useAuth()` — never read
`user_metadata` for access control, it is user-editable. Gate routes with `RequireAuth`:
unauthenticated → `/login`; authenticated but no role yet → pending-approval screen; wrong role
(when `roles` is passed) → access-denied. See `src/features/team/index.tsx` for a role-gated
route and `src/app/RequireAuth.tsx` for the guard itself.
