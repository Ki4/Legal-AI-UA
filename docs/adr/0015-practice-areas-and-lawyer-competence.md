# ADR-0015: A service sits in one practice area; a lawyer holds competences

- Status: accepted
- Date: 2026-08-12

## Context

The catalogue is a flat list. With three services that is not a problem; the first firm to put
thirty services on the platform has no way to find anything, and no way to say what a given lawyer
is qualified to answer for.

Two concrete things are blocked on the absence of an axis.

**The catalogue cannot be narrowed.** `ServiceFilter` filters by status, by mode and by lawyer —
all of them properties of how a service is being worked on, none of them about what the service
_is_. A lawyer looking for "the family-law services" has to read every title.

**The assignment editor offers everybody.** ADM-10 shipped a picker that lists every approved
lawyer, which is right while the firm has two of them and absurd when it has twenty. Nothing in
the system knows that a divorce petition wants somebody who does family law. The person moving
accountability has to hold that knowledge in their head, and the §9.16 triage deadline addresses
whoever they picked.

The word "category" is wanted by three different consumers, and they do not want the same list:

| Who                    | What they need                           | The language they need it in |
| ---------------------- | ---------------------------------------- | ---------------------------- |
| A client on `apps/web` | to find the service that fits their mess | "my employer stopped paying" |
| The platform           | who may be offered a service, or cover   | branch of law                |
| Law monitoring (§9)    | which norms a service depends on         | act and article              |

The third is already answered and needs no rubric: a norm is watched once in a shared register and
service dependencies hang off it (ADR-0011). The first two are the question, and collapsing them
into one list makes both worse. A client does not think in `спадкове право`; they think "my father
died and there is a flat". A lawyer is not a specialist in "my father died"; they are a specialist
in inheritance law.

Ukrainian firms' own service pages confirm the split by violating it: they list `сімейне`,
`спадкове`, `трудове`, `банкрутство` next to `IT`, `агро`, `медицина` and `готельно-ресторанний
бізнес`. The second group is not branches of law at all — it is the client's industry. Three axes
are being flattened into one menu because a menu is all a website has.

## Decision

**1. A practice area is a row in a table, not a value in an enum.** `practice_areas` carries a
stable code, a uk and an en label, a sort position and an `is_active` flag. Adding one is an
insert; retiring one is an update. Maritime law is the case that settles this — it is real, it is
narrow, most firms never touch it, and the day one does, that must not be a migration and a
deploy.

**2. Exactly one area per service, and it is required.** It lives on `services`, not on
`service_versions`: the area is what a service _is_, and a service that changes area is a different
service. The freeze rules of ADR-0009 have nothing to say about it.

**3. A competence is a granted fact: `(lawyer, practice_area)`, written by an admin.** It is not
derived from past assignments — a competence inferred from what someone has already been given
lets the first assignment authorise itself, which is not a check, it is an echo.

**4. Competence steers the picker; it does not lock the table.** Lawyers holding the area are
offered first; the rest appear under a heading that says they are outside it, and choosing one
takes a reason that lands in `audit_events`.

A hard constraint was the tempting answer and it is wrong here. It breaks precisely the case cover
exists for — Friday, the two competent lawyers are away, the document is due — and it would push
the firm into keeping the competence table loose enough to never block anything, which is the same
as not having it. Free choice with no record is the other failure: ADR-0005 puts a lawyer in the
loop because they can _judge_ the document, and silently handing a document to somebody who cannot
is how that guarantee stops meaning anything. The repo already has the shape for this — break-glass
in ADR-0014. The exception is available, and it is never silent.

**5. Client-facing rubrics are a second axis, and they wait for `apps/web`.** Many-to-many with
services, written in the language of a person with a problem. They do not touch competence.

**6. Industry verticals are not practice areas.** If the firm ever wants to say "we serve agro",
that is a third axis, and it will be added as one or not at all.

**7. Deletion is available only while an area is unused.** After that it deactivates: a service
carries its area, `audit_events` refers to it, and a code that once meant something must keep
meaning it.

## The seed list

Fifteen areas, assembled from the structure of Ukrainian law and checked against what practising
firms actually name. Criminal law is deliberately absent: a document in a criminal matter is not a
genre that is generated from a template, and if that changes it is a decision, not an oversight.

| Code             | uk                            | en                        |
| ---------------- | ----------------------------- | ------------------------- |
| `family`         | Сімейне право                 | Family                    |
| `inheritance`    | Спадкове право                | Inheritance               |
| `civil`          | Цивільне та договірне право   | Civil and contract        |
| `property`       | Земельне право та нерухомість | Land and real estate      |
| `labour`         | Трудове право                 | Labour                    |
| `business`       | Господарське та корпоративне  | Business and corporate    |
| `tax`            | Податкове право               | Tax                       |
| `administrative` | Адміністративне право         | Administrative            |
| `enforcement`    | Виконавче провадження         | Enforcement of decisions  |
| `consumer`       | Захист прав споживачів        | Consumer protection       |
| `migration`      | Міграційне право              | Migration                 |
| `military`       | Військове та мобілізаційне    | Military and mobilisation |
| `social`         | Соціальні виплати та пільги   | Social benefits           |
| `insolvency`     | Банкрутство                   | Bankruptcy and insolvency |
| `ip`             | Інтелектуальна власність      | Intellectual property     |

This list is a starting position written by people who are not lawyers. It needs a lawyer's
reading before the first service is filed under it — not because the branches are in doubt, but
because how a firm divides its own work is a fact about that firm.

## Consequences

- One migration: `practice_areas`, `services.practice_area_id` (not null), `lawyer_competences`.
  Everyone signed in reads areas; only an admin writes them. Staff read competences; only an admin
  grants them. Being Tier 2, it ships with verification scenarios covering the denials.
- Backfilling `not null` onto existing rows needs a default area for what is already there. With
  three seeded services that is a one-line update, and it will never be this cheap again.
- The catalogue gains a filter and a grouping that mean something, and the service list can finally
  show what a service is without the reader opening it.
- The assignment picker stops being a flat roll of everybody.
- Signal triage (§9.16) gains an addressee beyond the accountable lawyer: a signal on a norm can
  reach people competent in the area rather than only the one person attached to the service.
- What this deliberately does not buy: a service in two areas. If that turns out to be needed
  often, the answer is a second axis of tags, not a second area — because the question competence
  asks has to have one answer.
