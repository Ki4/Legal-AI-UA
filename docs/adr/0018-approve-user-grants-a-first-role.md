# ADR-0018: `approve_user` grants a first role; changing one is a separate operation

- Status: accepted
- Date: 2026-08-14

## Context

`approve_user(target_user, new_role)` has shipped since `20260730120000_auth_profiles.sql`. It
checks that the caller is an admin and that the requested role is one of two words, then writes that
role into `auth.users.raw_app_meta_data` and mirrors it into `profiles.role` — for whatever user id
it was handed, whatever that user already holds.

So it has always been two operations wearing one name: **approving a registration**, which the team
screen calls, and **changing somebody's role**, which is ADM-33 and has no screen, no rule and no
decision behind it. The second was reachable by any admin through the RPC the first one uses, and
nothing in the repository said so except a comment in a fixture.

Three consequences, none theoretical:

1. **A stale list is a demotion.** The team screen offers approval on rows whose role is null at the
   time it rendered. Approved in another tab, or by another admin a minute earlier, that same click
   sends `approve_user(colleague, 'lawyer')` for somebody who is now an admin. The request cannot
   distinguish the two cases, because the request is the same request.
2. **There is no floor under the number of admins.** An admin could demote the last admin, including
   themselves. Recovery is the SQL editor and the bootstrap block at the top of the original
   migration — the one commented "run ONCE, then never again".
3. **Approving nobody reported success.** `update ... where id = <nonexistent>` matches no rows and
   raises nothing, so the console would say the person had been approved.

None of these is a hole in the _rights_ model: only an admin can call the function, and that was
always enforced. It is a hole in what the operation means, which is why it survived a live
end-to-end verification on 2026-08-01 and three sessions of it being written down under "left open".

## Decision

**Make the name true.** `approve_user` grants a role to a user who has none:

- A target that already holds a role is **refused**, and the message names the operation the caller
  wanted and says it does not exist yet.
- Re-approving with the role the target already holds is a **silent no-op**. A double-click is not
  an attempt to change anything, and an error there would make the one error this screen ever shows
  the one that never means anything.
- A target that does not exist **raises**.
- The role is read from `auth.users.raw_app_meta_data`, never from `profiles.role`. The original
  migration says the profile is a display mirror; a check that read the mirror could be defeated by
  drift between the two.
- Drift in the other direction is **repaired, not refused**: a profile carrying a role the JWT does
  not have describes a user who cannot actually do anything, and approving them is how that is
  fixed.

The alternative — keep one function and add a `force` argument, or a confirmation in the UI — was
rejected. A confirmation dialog is not a rule, it is a habit; and an operation that takes a flag to
mean something else is the same two operations with a shorter name.

## Consequences

- **ADM-33 must build its own RPC.** Changing a role now needs a function that says so, and that
  function needs the thing this one deliberately does not have: a rule about the last admin. That is
  a decision to make with the screen, not to inherit from a bug.
- **The console's fixture had to move with the schema.** `team.mock.ts` refused nothing, on the
  recorded grounds that a mock stricter than the database teaches the screen a rule Postgres will
  not honour. That reasoning is unchanged and now points the other way, so the fixture refuses too.
  A test that asserted the old behaviour — "changes an existing role, because `approve_user` does
  not refuse to" — is now the assertion that it does.
- **An audit row for a role grant is still missing.** ADR-0010's log is exactly where "who made this
  person a lawyer, and when" belongs, and `public.profiles` has no entity mapping in
  `audit_change()`. Adding one also starts logging every registration, which is a decision of its
  own. Left out deliberately, recorded here so it is a list rather than a feeling.
- **The verification script is the evidence.** `supabase/snippets/verify_approve_user.sql`, 13
  scenarios. Run against the function as it shipped in July, six of them fail — including an admin
  demoting themselves and a nonexistent user reporting success. Run against this migration, all
  pass. A verification that has not been run against the defect proves only that today's code
  agrees with today's assertions.
- **This migration touches access control and was merged without a second reviewer**, under the
  suspension clause in `docs/CONTRIBUTING.md`. It joins the list that clause says gets its review
  the day a second developer arrives.
