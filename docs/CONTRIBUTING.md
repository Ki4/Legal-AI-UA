# Contributing

The team's working rules: who owns what, how a change gets from idea to `main`, and how we work
with AI assistants. Read the root `CLAUDE.md` and your zone's `CLAUDE.md`
(`apps/console/CLAUDE.md`, `supabase/CLAUDE.md`) first — this document doesn't repeat their
content, it links to it.

## Team and ownership zones

Three roles: product owner, core owner, design-system owner. **They are zones, not people.** One
developer holds all three today.

That distinction is worth stating plainly, because the rest of this document was written in a voice
that assumes otherwise, and reading it literally produces nonsense: "the core owner countersigns
the contract" becomes a person waiting to be consulted who does not exist, and a task can look
blocked on them. It is the same person in a different zone. Where a rule depends on a _second pair
of eyes_ rather than a second zone — the access-control review below — the dependency is real, and
what stands in for it is spelled out in "While the team is one developer".

The zones are kept anyway, and kept accurate. They draw boundaries that are real regardless of the
headcount — the console never reaches into the core, `packages/ui` never imports from `apps/*` — and
they are what a second developer joins into. A split invented on the day somebody arrives is a split
nobody has tested.

Ideas mostly start with the product owner. Decisions are made together once there is more than one
person to make them with; until then, "discussed together" means written down where the next reader
can disagree with it, which is what the ADRs are for.

| Zone                                                                                   | Owner               | Notes                                                        |
| -------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| Database, migrations, app carcass, rules                                               | Product owner       | Also brings product ideas; coordinates cross-zone questions  |
| AI core (`apps/core`, `packages/core-client`)                                          | Core owner          | See `docs/adr/0004-ai-core-separate-service.md`              |
| Design system + console feature screens (`packages/ui`, `apps/console/src/features/*`) | Design-system owner | See `apps/console/CLAUDE.md` for the feature-isolation rules |

**Ownership rule, applies to everyone:** a PR touching files outside the author's zone needs the
zone owner's review, regardless of the review matrix below.

## Git conventions

- Branch per task, named `<owner>/<task>` (e.g. `sergey/orders-table`).
- `main` is always deployable.
- One PR = one module. Keep it small — roughly 400 lines max. Split larger work into a sequence
  of PRs rather than one big one.
- Commit messages follow Conventional Commits; `commitlint` enforces this locally via Husky.

**Do not stack pull requests.** The 2026-08-04 journal concluded that stacking is safe if the base
branch is deleted on merge. Tried on 2026-08-11 with four stacked PRs, and it is not: deleting the
base branch **closed** the dependent PR unmerged instead of retargeting it, and the one PR that did
merge landed in a feature branch rather than `main`. Nothing was lost, because the branch at the
top of the stack carried every commit and applied to `main` cleanly — which is also the recovery:
open one PR from the topmost branch and let the intermediate ones close.

If work genuinely depends on unmerged work, either merge the base to `main` first and branch again,
or ship it as one PR and say so in the description.

## Review policy

This is a **default matrix**, not a hard gate — use judgment.

| Author              | Reviewer                          |
| ------------------- | --------------------------------- |
| Design-system owner | Core owner or product owner       |
| Product owner       | Core owner or design-system owner |
| Core owner          | No mandatory reviewer             |

Any of the three may push directly or self-approve when it's pragmatic — a small change, inside
their own zone. The matrix is the default expectation, not a lock.

**With one developer holding all three zones, every row of this matrix resolves to self-approval.**
That is not a loophole to feel bad about; it is what the table says when the zones collapse onto one
person. The one row that does not resolve that way is the hard exception below, because it asks for
independence rather than for a zone.

**The one hard exception:** migrations touching access control (RLS policies, `auth.*`, JWT
`app_metadata`, consents) require a second reviewer, core owner preferred, and no self-merge. See
`supabase/CLAUDE.md`. This exception overrides everything above, including self-approval and the
"no mandatory reviewer" row.

### While the team is one developer

The rule above assumes a second human is available. Today the repo is worked by one developer with
an AI assistant, and an assistant cannot be the second reviewer: it wrote the migration, so its
review of that migration is not independent evidence of anything.

A rule that is broken on every change stops meaning anything, so it is suspended rather than
quietly ignored — and it is suspended against a substitute, not against nothing:

1. **Every policy ships with a runnable verification script**, not a paragraph in a PR description.
   It lives in `supabase/snippets/verify_<area>.sql`, creates its own fixtures, attempts to break
   every rule it claims to enforce, prints PASS/FAIL, and rolls back. Re-runnable months later.
2. **The author reads the SQL themselves before applying it.** A verification script proves the
   rules it thought to test; a human reading proves nothing was left untested.
3. **The deviation is recorded** in the PR description or the session journal — which migration,
   which date. Not to apologise for it, but so the backlog of unreviewed access-control changes is
   a list rather than a feeling.

**This clause expires the day a second developer joins.** At that point the rule above applies
unchanged, and the migrations recorded under point 3 get the review they did not get at the time.

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
- Cross-zone or product questions are discussed together; when consensus doesn't emerge, the
  product owner has the final call.
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
