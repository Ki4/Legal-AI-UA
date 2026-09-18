# ADR-0027: Publication is three acts, and the professional one belongs to a practice area's signatories

- Status: accepted
- Date: 2026-09-18

## Context

This answers Q28. §13 records that inside the catalogue the split is commercial versus
professional: an admin decides what is on sale, at what price and when; the assigned lawyer owns the
draft. Read as it was built, that gives the admin the last word on whether a service exists at all —
`published_at` is the admin's column, and nothing between a lawyer's draft and a client is signed by
a lawyer.

The product owner's position, stated on 2026-09-18, is that this is wrong in principle and not only
in ergonomics: **an admin is a technical person, and approving a legal service is an expert
judgement.** Giving them the button is possible; giving them the responsibility is strange, because
the expertise is not theirs. What is wanted is a lawyer of the firm who is accountable for what
enters the catalogue, and who confirms the services that other lawyers add.

Read literally, that is a senior lawyer above the others — the split §13 rejected, and a third role.
It is not, and the reason is worth keeping: every domain that publishes content it is liable for has
the same shape and none of them expresses it as rank.

| Where                                   | Author      | Professional sign-off                        | Release to the public |
| --------------------------------------- | ----------- | -------------------------------------------- | --------------------- |
| Document control (ISO 9001, pharma SOP) | author      | approver, **designated per area**            | document controller   |
| Medical-legal review of pharma content  | marketing   | designated medical reviewer                  | marketing publishes   |
| Code review (CODEOWNERS)                | PR author   | owner of the path; **author cannot approve** | whoever merges        |
| Editorial CMS                           | contributor | editor — a capability, not a rank            | publisher             |
| A law firm                              | any lawyer  | head of the practice area                    | the partner who sells |

Three things recur. The sign-off is **designated by area**, not by seniority. The author and the
signatory are **two people** wherever there are two to be had. And the sign-off is **not the sale**:
the person who says "this is correct" and the person who says "this is on the shelf at this price"
are separate even when they are the same human.

## Decision

**Publication is three acts on three columns, and no new role.**

```
    author                    signatory of the area              admin
    (assigned lawyer)         (practice_area_signatories)        (commercial)
draft ──► in_review ─────────► released ─────────────────────► published
 edits     "ready, check it"     released_by / released_at        published_by / published_at
                                 refused unless caller signs       refused unless released
                                   for this area                   refused unless template frozen
                                 refused if caller authored it
                                 (no other signatory: allowed, flagged)
```

**1. A practice area has signatories: one head and any number of release reviewers.**
`practice_area_signatories (practice_area, lawyer_id, is_head, appointed_by, appointed_at)`, with
exactly one `is_head` per area held by a partial unique index — the pattern `service_assignments`
already uses for its one accountable lawyer. "Our lawyer accountable for services" is the head of
the area the service sits in, and `services.practice_area` is already required (ADR-0015), so every
service resolves to its area's signatories or to none. An area with no signatory cannot have a
service released in it, which is the correct failure: it is the firm saying nobody has taken
responsibility for family law yet.

Who is head is set by an admin, because it is an organisational fact like assignment and not an
expert one. Who else may sign in the area is the **head's own appointment**, because judging who is
fit to check a colleague's work is exactly the expert act this ADR keeps away from the technical
owner — the same reason the accountable lawyer arranges their own cover in §4.2. An admin may also
appoint, with the picker of §5.6 offering competent lawyers first and anyone else under a heading
and with a reason. Both are recorded like any assignment. A reviewer is appointed per area: signing
in family law says nothing about litigation.

**2. Release is a signature, so it is two columns and not a status.** `released_by`, `released_at`
on `service_versions`, set through one RPC. A status can be walked back to `draft` and then nobody
knows who signed; a column is a fact. The RPC checks that the caller's active role is `lawyer`, that
they are a signatory of the service's area, that the version is `in_review`, and that the template
version it binds is frozen (ADM-30's act, which is the author's own: freezing content is not selling
it). Any change to the version's content after release clears both columns — the signature stands
under one text and not under whatever the text becomes.

**3. Four eyes, enforced when there are four.** A signatory may not release a version they authored
(`created_by`, added to `service_versions`) — except when the area has no other signatory, which is
the founding case and this year's case. Then the RPC allows it and stamps the audit row
`self_released`. The flag is the enforcement: it is a count of how often the rule could not be
applied, visible in §4.7, and the remedy is one appointment away and in the head's own hands. The
day a second signatory exists in the area the exception stops firing. This is deliberately a flag
and not a config switch or a role — nothing has to be turned on.

**4. Sale stays with the admin and cannot precede the signature.** `published_at` is still the
admin's column, the previous live version is still archived by the same act, and the guard now
also refuses a version with `released_at is null`. The technical owner still decides when and at
what price; they can no longer put on sale something no lawyer has signed. §13's line survives with
one word changed — the split is commercial versus professional, and the professional half now has
a signature in it.

**5. Who may stop a service is wider than who may start it.** A pause is a safety act, so any
signatory of the area and the accountable lawyer may pause for a professional reason and the admin
for any reason. A
pause takes a reason and is a row, and who lifts it depends on why it was opened — §5.7 of
`docs/specs/admin-console.md` has the detail, because it is a story about operating a live service
and not about the role model.

## Consequences

- **ADM-31 is unblocked with the right owner.** It becomes two rights on two columns: a lawyer's
  release and an admin's sale. §4.3's stories are rewritten accordingly; the versions table gains
  "released by / when" beside "published by / when".
- **The founding team's first services carry one signature, and it is the lawyer's.** Two technical
  co-owners and one advocate: the advocate authors and self-releases (flagged), a technical co-owner
  puts on sale. No technical person's name ever appears under the professional act. That is the
  whole point, and it is true from the first row.
- **Assignment and signing are two different questions and stay on two tables.** Assignment
  (§4.2, ADR-0014) says who works on and answers for a service day to day, and grants client data.
  A signatory says who may sign for an area. A signatory is usually also assigned to services in
  their area and need not be; the RPC reads `practice_area_signatories`, not `service_assignments`.
- **A new lawyer is not held up by any of this.** They hold competences and assignments from day
  one and author from day one; they sign when a head appoints them. That is the ordinary shape of
  joining a firm, and it costs the newcomer nothing they would not expect.
- **This is not seniority and does not become it.** There is no `senior` value anywhere, no ordering
  of lawyers, and a lawyer who heads family law is nobody's superior in litigation. A reviewer is
  not a rank either — it is an appointment in one area, revocable by the same hand. If the firm ever
  wants a lawyer who signs across all areas, that is a signatory of every area — rows, not a role.
- **Every published version has three names on it**, and every pause has a reason and a resolution.
  That is what makes §5.7 answerable — what went wrong, and whose question it is — without the
  product taking a decision that belongs to the partners.
- **The client-facing claim is not decided here.** Whether the signatory's name is shown on the
  shop window is Q20's territory (a competence is a public claim) and `apps/web`'s. The column exists
  either way.
- **Cost.** A `practice_area_signatories` table, three columns on `service_versions`, one RPC,
  one guard extended, a `service_pauses` table (§5.7), and the stories in §4.3. ADR-0026 was written so that
  either answer to Q28 changed the publish site alone, and it did.
