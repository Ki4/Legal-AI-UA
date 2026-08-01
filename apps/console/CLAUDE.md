# apps/console — context

Lawyer/admin cabinet. Read the root `CLAUDE.md` first.

## Feature folder anatomy

```
src/features/<name>/
  components/   feature-local UI
  api/          data access — mocks from @legal-ai/db today, Supabase later
  hooks/        feature-local hooks
  index.tsx     exports the feature's RouteObject[]
```

Rules:

- A feature imports only from `packages/*` and `src/app/`/`shared/`. Never from a sibling
  feature — if two features need the same thing, it belongs in a package.
- All data access goes through the feature's own `api/` layer. Components call `api/`, never
  Supabase or `@legal-ai/db` directly — that's what lets mocks become live queries without
  touching a single component.

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
