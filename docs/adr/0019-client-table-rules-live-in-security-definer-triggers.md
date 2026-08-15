# ADR-0019: Rules on client-bearing tables live in security-definer triggers

- Status: accepted
- Date: 2026-08-15

## Context

Until `orders` there was one place a rule about client data could plausibly live, and the repository
never had to choose: every table so far was either catalogue, where RLS and a role claim are exactly
the right instrument, or `client_identities`, which nobody may read and which therefore needed no
rule beyond withholding the grant.

`entitlements` and `orders` are the first tables where a rule is about **what a write may do**
rather than about who may see a row. A document may not be delivered without the lawyer ADR-0005
requires. An order may not be re-pointed at another version, because ADR-0009's passport is exactly
that pin. A delivered order must name the purchase that paid for it. These are not visibility
questions, and RLS answers only visibility questions.

Three facts about this system decide where they go instead, and each one was found rather than
assumed.

**The only writer bypasses RLS.** Orders arrive through the gateway (ADM-5, §6.3), which holds
`service_role`. Row Level Security does not apply to it at all. A lifecycle enforced by a policy
would be a lifecycle the one thing that writes orders is not subject to — a rule that reads as
enforcement in the migration and enforces nothing in production. ADR-0009 already reached this
conclusion for the version freeze and said so in the catalogue migration; what is new is that it now
covers a whole table's behaviour rather than one immutability rule.

**A guard that runs as its caller sees less than the truth, and fails in both directions.** The
delivery guard reads `entitlements` to check that the named purchase covers the service. A lawyer
may not read `entitlements` at all — that is the decision in §8.6, and it is right. A caller-rights
guard would therefore find nothing and refuse a correct delivery with a sentence about another
client's purchase. Worse in the other direction: the same guard reads `service_versions` to refuse
an order against an unpublished version, and a narrowed policy there would leave the check comparing
against `null`, which is not `<> 'published'`, which raises nothing at all. One failure is loud and
wrong; the other is silent and wrong.

**A refusal can be made loud only where nobody is allowed in.** `client_identities` fails with a
permission error because its grant is withheld from everybody, and that was recorded at the time as
the better failure — a missing grant errors, a missing policy returns an empty array. It does not
generalise. An admin must read `entitlements`, and an admin and a lawyer reach Postgres as the same
database role, `authenticated`, with the distinction living in a JWT claim that a grant cannot see.
The grant is therefore unavoidable, the policy is what filters, and a lawyer meets the ambiguous
empty result that §13 warns about.

## Decision

**On a client-bearing table, RLS decides who may read a row and a `security definer` trigger decides
what a write may do.** The two are not alternatives and neither substitutes for the other.

- Every rule about the transition of a row — lifecycle, pinning, preconditions for delivery — is a
  `before` trigger, so it holds against `service_role`, against a migration, and against whatever
  writes the table next.
- Those triggers are `security definer`. What a guard is allowed to see is not the same question as
  what the writer is allowed to see, and answering the first with the second is how a guard fails
  silently.
- RLS still carries visibility, and its predicates key on assignment or on a live grant, never on a
  role claim alone (ADR-0014). `orders.reviewer_id` is the per-matter anchor for that, distinct from
  `service_assignments`, which says who may be _offered_ work rather than who took it.
- **Where a table has an authorised reader inside `authenticated`, plan for the silent empty
  result.** The answer is not a better error message; it is that no screen without the right reads
  the table at all. `client_is_entitled_to()` is the shape that takes: a `security definer` function
  gives a lawyer the yes/no their screen needs while the rows stay administration's.

## Consequences

- A rule enforced by a trigger cannot be read off the policy list, so a reviewer looking for "what
  can happen to this row" has two places to look instead of one. The verification script is what
  keeps that honest, and it is why `supabase/CLAUDE.md` requires one per policy area: the scenarios
  are run as `postgres`, which is the writer that no policy constrains, so they test the rule as the
  gateway will meet it rather than as a browser would.
- `security definer` is a real escalation. Every one of these functions pins an empty `search_path`
  and states its reason in the migration. A guard written this way that also _writes_ outside its
  own table would be a privilege escalation with a trigger for a front door; none of them do, and
  that is a property to check when the next one is added.
- Two ways to fail a write now exist and they are not interchangeable. A trigger raises a sentence a
  person can read; RLS returns an empty result or a permission error depending on whether a grant
  was withheld. Screens over client data have to be built for all three, which is what makes
  "depersonalised-first" (ADR-0014) a UI decision and not only a data one.
- The probes matter more here than in a policy-only design, because a trigger that has been
  weakened still exists and still looks like enforcement. Each of the three rules this ADR is
  written about was checked by breaking it: replacing the review requirement with `if false`,
  asking the coverage question of the client rather than of the purchase, and dropping the reviewer
  arm of the read policy. Each turned exactly one scenario red.
- Cost accepted: more machinery than a policy, on every client-bearing table from here. ADM-64's
  answers and ADM-65's documents will each carry their own, and their narrower read predicates key
  on `orders.reviewer_id`, which is why that column exists before there is a screen that sets it.

See `docs/specs/admin-console.md` §8.6 for the entitlement shape these guards check against, §6.1
for why `orders.status` is a column despite the log being the record, and §13 for the silent-refusal
finding in the form the console has to consume.
