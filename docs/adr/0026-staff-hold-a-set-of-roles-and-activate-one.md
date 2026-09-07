# ADR-0026: Staff hold a set of roles; the token carries one active role

- Status: accepted
- Date: 2026-09-07

## Context

This answers Q25. Today a role is a single value: `auth.users.app_metadata.role` holds one word,
`jwt_role()` returns it, `approve_user` accepts one of two, and **88 sites across
`supabase/migrations/` compare it against a literal**. An admin cannot review an order — the
lifecycle guard requires `profiles.role = 'lawyer'` — and a lawyer cannot publish or price.

The founding team is two or three technical people and two advocates who are co-owners of the
firm. A person who both practises and administers is therefore the normal case here, not the
exception the model treats it as. Nobody knows when the next person arrives or what they will be,
which is the argument for settling the shape now: it is a migration over one user and almost no
data today, and the same migration plus every live token a year from now.

### Why the obvious fix is the wrong one

The fix Q25 itself proposed — roles become a set, `jwt_role()` becomes `has_role()` — carries a
defect that survives review, tests and a green pipeline.

Of the 88 sites, 84 ask _may this caller do X_ and translate directly:
`using (jwt_role() in ('admin','lawyer'))` becomes `has_role('admin') or has_role('lawyer')` and
means the same thing. Four do not. They are guards inside triggers, and there `= 'lawyer'` means
**only a lawyer and nobody else**:

```
20260811120000_catalogue_services.sql:121    the slug and the assignment are not the lawyer's
20260811160000_service_assignments.sql:128   the slug again
20260812120000_practice_areas.sql:128, :132  the slug and the practice area
```

Translated mechanically to `has_role('lawyer')`, an advocate who also holds `admin` is refused a
change they are entitled to make as an admin. The SQL is valid, the tests are green, and the screen
refuses with a sentence that is now false. Under union semantics each of those four has to be
rewritten as "the more privileged role wins" — a rule that exists nowhere today and would have to
be held in the head of everyone who writes the ninth guard.

The union costs a second thing that cannot be repaired afterwards. `audit_events.actor_role` records
`jwt_role()` at the moment of the write, and the log is append-only (ADR-0010): what it stores is
what it stores. With a set in the token there is no single value to record, and "the roles this
person held" is not the question the column was asked — it is the same answer for every row that
person ever writes, which is to say no answer at all.

Both problems are properties of _union semantics_, not of roles being plural. That is what decides
this ADR.

## Decision

**Staff hold a set of roles. The token carries exactly one of them — the active role.** `jwt_role()`
keeps its name, its shape and its meaning: the role the caller is acting in right now.

This is NIST RBAC's own arrangement — a user is assigned many roles and activates a subset in a
session — with the subset fixed at one. AWS IAM (`assume-role`, and CloudTrail recording the role
that was assumed) and Azure PIM (eligible versus active) are the same shape in production.

Five things follow, and the fourth is the one that will be tempting to skip.

**1. The 88 sites do not change.** Not the 84 permissive ones and not the four guards. `= 'lawyer'`
continues to mean what it has always meant, so there is nothing to translate and therefore nothing
to translate wrongly.

**2. One rule, and it fits in a sentence.** _A capability check reads the active role; a statement
about a person reads the held set._ Exactly one site in the repository is of the second kind:

```
20260815130000_orders.sql:282   profiles.role = 'lawyer'   -- "a reviewer is a lawyer"
```

That is a fact about the person being made reviewer, not about the hat they had on when they were
assigned, so it moves to the held set. Every other site stays on the active role.

**3. The held set lives in a table, not in a jsonb array.** `user_roles`, one row per person per
role. A table has foreign keys and RLS; more to the point it can carry an entity mapping in
`audit_change()`, and that is the thing ADR-0018 recorded as missing and left missing — "who made
this person a lawyer, and when" has no row today. An array inside `app_metadata` is invisible to the
audit log and to every join, and would leave that debt exactly where it is.

The claim is written by a Supabase **custom access token hook**, declared in `supabase/config.toml`
so the local stack, the SQL job in CI and the cloud all mint the same token. The hook is the
documented mechanism for this and it re-runs on refresh, so a role change propagates without a
forced sign-out.

**4. The token also carries `roles_available`, and the database may never read it.** The switcher in
`AppShell` has to know what the person can switch to; nothing else does. A policy written against
`roles_available` would be union semantics smuggled back in, together with both defects above, and
it would look entirely reasonable in a diff. So `pnpm check:sql` fails on a migration that mentions
it. A rule that has to be remembered is the defect this repository writes gates for.

**5. Switching is explicit.** Two alternatives were considered and rejected. _Everything at once_ is
the union, above. _Automatic switching_ — the console silently requesting the role a screen needs —
keeps the model and throws away what it buys: the audit log would record `admin` for an act the
person never thought of as administrative, which is worse than the tautology it replaced. An
administrative act being a deliberate act is the point, not the price.

### Actor type is a second axis, and it is single-valued

Clients authenticate in the same Supabase project as staff when `apps/web` arrives. Two projects
would put client data and staff on opposite sides of a boundary no query crosses, and ADR-0014's
whole model — a lawyer reads their client's data because they are assigned to it — needs both in one
database. One contour is also what a single Supabase project is shaped for.

What separates them is a **type of actor** — `staff`, `client`, `system` — which is one value and
never a set. A role set exists only inside `staff`; a client is not a staff member with an empty one.
The current default is already the safe one and stays: a user with no role can do nothing, so
self-registration into a shared pool grants nothing by existing. Two disciplines follow from it:
policies are written positively (`type = 'staff' and jwt_role() = ...`), never as "not an admin",
and a client and a staff member are never the same auth user even when they are the same human.

### Three phases

Each is worth landing on its own, and none rewrites the 88 sites.

**Phase 1 — the table and the hook, with behaviour unchanged.** Everyone holds exactly one role; the
hook stamps it into the claim; `approve_user` writes `user_roles` instead of jsonb. Nothing observable
changes, and the audit gap ADR-0018 named closes on the way past.

**Phase 2 — more than one held role.** `active_role`, the switcher, `roles_available`, the
`check:sql` gate, and `orders.sql:282` moving to the held set. This is the phase Q25 was actually
asking for.

**Phase 3 — activation with a reason and an expiry.** Which is ADM-56 and §7.3's break-glass wearing
the same machinery, and where separation of duties goes if hired staff ever make it necessary. Not
built until something needs it.

## Consequences

- **The access-control review pass and this change are one traversal.** Q25 already said so, and it
  is more true now: phase 2 touches the same area and the two together cost one pass over the
  riskiest part of the schema instead of two.
- **Every verification scenario is re-run in both directions**: once for a person holding one role,
  once for a person holding two and acting in each. The 16 snippets under `supabase/snippets/` fake
  a JWT with `set local request.jwt.claims`, so both directions are a second literal, not a second
  harness.
- **The console's cost is small and central.** `auth.tsx` reads the claim, `RequireAuth` already
  takes `roles?: Role[]`, and `AppShell` already renders the role — the switcher lands where the
  role is displayed today. The copy for "this is an administrative action and you are acting as a
  lawyer" is a dictionary key like any other.
- **Switching is a real cost, and it falls on the advocates rather than on the person deciding
  this.** They will sit in `lawyer` and step into `admin` occasionally. That is the ergonomics AWS
  and Azure chose for the same reason, and it is the honest price of an audit log that means
  something.
- **`approve_user` still only grants a first role.** Adding and removing roles from a set is
  ADM-33's RPC and needs the rule ADR-0018 refused to invent: a floor under the number of admins.
- **What this does not decide is who publishes**, which turned out to be a larger question than the
  role model — recorded as Q28. This ADR is written so that either answer is a change at the
  publish site and nowhere else.
- **This is an access-control change merged without a second reviewer**, under the suspension clause
  in `docs/CONTRIBUTING.md`. It joins the list that clause says gets its review the day a second
  developer arrives.
