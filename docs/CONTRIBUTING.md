# Contributing

The team's working rules: who owns what, how a change gets from idea to `main`, and how we work
with AI assistants. Read the root `CLAUDE.md` and your zone's `CLAUDE.md`
(`apps/console/CLAUDE.md`, `supabase/CLAUDE.md`) first — this document doesn't repeat their
content, it links to it.

## Team and ownership zones

Three people today: Sergey (product owner), the senior developer, the junior frontend developer.

| Zone                                                                                   | Owner                     | Notes                                                        |
| -------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| Database, migrations, app carcass, rules                                               | Sergey                    | Also product owner for cross-zone decisions                  |
| AI core (`apps/core`, `packages/core-client`)                                          | Senior developer          | See `docs/adr/0004-ai-core-separate-service.md`              |
| Design system + console feature screens (`packages/ui`, `apps/console/src/features/*`) | Junior frontend developer | See `apps/console/CLAUDE.md` for the feature-isolation rules |

**Ownership rule, applies to everyone:** a PR touching files outside the author's zone needs the
zone owner's review, regardless of the review matrix below.

## Git conventions

- Branch per task, named `<owner>/<task>` (e.g. `sergey/orders-table`).
- `main` is always deployable.
- One PR = one module. Keep it small — roughly 400 lines max. Split larger work into a sequence
  of PRs rather than one big one.
- Commit messages follow Conventional Commits; `commitlint` enforces this locally via Husky.

## Review policy

This is a **default matrix**, not a hard gate — use judgment.

| Author              | Reviewer                                |
| ------------------- | --------------------------------------- |
| Junior frontend dev | Senior developer or Sergey              |
| Sergey              | Senior developer or junior frontend dev |
| Senior developer    | No mandatory reviewer                   |

Any of the three may push directly or self-approve when it's pragmatic — a small change, inside
their own zone. The matrix is the default expectation, not a lock.

**The one hard exception, no self-merge ever:** migrations touching access control (RLS policies,
`auth.*`, JWT `app_metadata`, consents) always require a second reviewer, senior developer
preferred. See `supabase/CLAUDE.md`. This exception overrides everything above, including
self-approval and the "no mandatory reviewer" row.

**SLA:** 24 hours. If a review hasn't happened after 24 hours, escalate at the Monday sync instead
of waiting further.

## Spec tiers

How much upfront spec a piece of work needs, before code:

- **Tier 0 — trivial.** Straight to a PR. No issue needed.
- **Tier 1 — default.** Open an issue with checkable acceptance criteria before starting.
- **Tier 2 — full spec + ADR.** Automatically triggered by any of: migrations, RLS/auth changes,
  consents/GDPR-touching fields, payments — regardless of how small the diff looks. Write the ADR
  under `docs/adr/` following the existing numbering and structure (see `docs/adr/0001-*.md` for
  the template shape: Context, Decision, Consequences).

## Conflict resolution

- Inside a zone, the owner decides.
- Cross-zone or product questions go to Sergey as product owner.
- Anything legal/GDPR: the stricter reading wins until the question is explicitly resolved.
- Log disagreements as one line in the relevant ADR — not in chat, not lost.

## Verification rule

Any "already done" or "it works" claim — from a doc, a model, a teammate's memory, or your own
memory — is a hypothesis until verified against the actual code or the running system. "Works"
requires two agreeing pieces of evidence, and at least one of them must show the thing being
**invoked**, not just defined (a function existing is not the same as a function being called
from somewhere that runs). This applies equally to AI assistant output: "my assistant said so" is
not an argument in a PR or a discussion — a link to code, a test result, or a screenshot is.

## GDPR: new personal-data fields

Any PR that adds a new field collecting personal data must answer, in the PR description:

1. Why is this field needed?
2. What is the legal basis for collecting it?
3. How long does it live (retention)?

No answer, no merge. Separately: never log personal data — log an order id, not a name or email.
Secrets live only in environment variables; the Supabase `service_role` key never reaches the
frontend or git.

## Working with AI assistants

- **One task, one chat.** Don't reuse a long-running chat across unrelated tasks — context rot
  produces worse output than starting fresh.
- **Two strikes.** After two failed attempts at the same problem in one chat, start a new chat
  with a better prompt instead of trying a third time in the same thread.
- **Delegate research, not conclusions.** Heavy research (reading many files, exploring an
  unfamiliar area) goes to a subagent; only the conclusions come back into the main thread.
- **Journal sessions with no PR.** If a session produced no PR (dead end, research only, blocked),
  leave a short entry at `docs/journal/<name>-<date>.md` — what was tried, what was learned.
  Sessions that do produce a PR document themselves in the PR description; no separate journal
  entry needed.
- Session language with your assistant is your own choice. What ends up in the repo — code,
  comments, commits, PRs, issues, ADRs, journals — is always English. See the language rule in
  the root `CLAUDE.md`.

## Roles (reference)

`admin` and `lawyer` roles live in JWT `app_metadata`, set server-side only via the `approve_user`
RPC (`supabase/migrations/20260730120000_auth_profiles.sql`). `user_metadata` is user-editable
and must never gate access. "Main admin" (the first admin, bootstrapped manually — see the
comment at the top of the auth migration) is an organizational fact, not a third role. A
`superadmin` role is a deliberate deferral: add it only when a real capability exists that only
one person may hold, not preemptively.
