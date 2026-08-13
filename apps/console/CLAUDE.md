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

**Rows are snake_case, view models are camelCase.** Row types in `packages/db` are generated from
the schema (`pnpm db:types`), so they carry Postgres's naming; a view model carries the shape a
screen renders. Mapping between the two is what the `api/` layer is _for_ — that is why
regenerating types cannot reach a component. If you find yourself wanting a camelCase row, you are
about to put the mapping in the wrong place.

Nothing is left to migrate: every feature, `anatomy` included, reaches its data through this layer.
`anatomy` was the cheap half — it renders a hardcoded trace and has no queries at all — which is
exactly why it stopped being the listed exception rather than staying one.

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

## Copy: dictionary keys only

The companion to the rule above. A screen hardcodes neither its colours nor its words.

Write for both languages from the first line — not because a translation is coming later, but
because it is not. A screen written in one language and translated afterwards gets rewritten
afterwards: which states exist, which sentence each one gets, and whether a phrase is counted are
decisions the copy makes, and doing them twice is doing them differently.

- Every user-visible string is `t("some.key")` from `useI18n()`, with the key added to **both**
  dictionaries in `packages/i18n`. `uk` defines the key set and `en` is typed against it, so
  forgetting one is a compile error rather than a blank label somebody finds in production.
- Counted phrases use `tCount`, never `count === 1 ? a : b`. Ukrainian has three plural forms
  where English has two.
- Errors live in state as `TranslationKey`, not as translated sentences — otherwise switching
  language leaves the old one on screen. Map an error **code** to a key; never render
  `error.message`, ours or a vendor's.
- Anything reaching `Intl` — money, dates — takes `intlLocale` from `useI18n()`.
- Schema enums a person reads (`status`, `generation_mode`, `review_mode`) go through
  `src/shared/vocabulary.ts`, which is `Record<Enum, TranslationKey>` — so a value added in a
  migration fails to compile until it also has a word.
- Reference data an admin edits at runtime (practice areas) is **not** dictionary material: no
  build-time dictionary can name a row inserted tomorrow. Those carry a label column per language
  and the view model carries them all.
- `admin` and `lawyer` are never translated. They are the words an RLS policy and the JWT are
  written in, and a reader comparing a screen to a policy needs the same word in both. Only the
  absence of a role is our sentence.

The checkable form, with the reasoning, is `docs/specs/console-feature-dod.md` §6.

## Role guards

Roles come from the JWT `app_metadata` only, surfaced through `useAuth()` — never read
`user_metadata` for access control, it is user-editable. Gate routes with `RequireAuth`:
unauthenticated → `/login`; authenticated but no role yet → pending-approval screen; wrong role
(when `roles` is passed) → access-denied. See `src/features/team/index.tsx` for a role-gated
route and `src/app/RequireAuth.tsx` for the guard itself.
