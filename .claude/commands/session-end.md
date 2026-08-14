---
description: Close a session — rewrite STATE, archive what aged, propose the journal for approval
---

The mirror of `/session-start`. Nothing here writes without the user agreeing to it first: a
document nobody read is worse in the permanent record than a document nobody wrote.

This command is also what keeps the tiering honest. `/session-start` is cheap because `STATE.md` is
small and `ROADMAP.md` is a map rather than a changelog, and both of those are true only for as long
as this command does its work. `pnpm docs:check` enforces the sizes; it cannot enforce the judgement.

Gather, then propose:

1. Run `git log --oneline <since the session began>` and `git status`. If the start point is
   unclear, use `git log --oneline -15` and ask which commits belong to this session.
2. Run `pnpm docs:check`. Anything it reports is a fact, not an opinion — fix it before proposing
   anything else. If it fails on a size budget, that is this command's work arriving, not an
   obstacle to it.
3. **Rewrite `docs/STATE.md` from scratch.** Not appended to — rewritten, so it describes the
   repository as it is now rather than accumulating. It carries the commit it was written at, the
   wave, what is in flight, the blocking questions with what each one stops, the debts **with the
   date each was first recorded**, and two or three next candidates. Budget is 60 lines, and it is a
   real budget: if it does not fit, something has to be closed or moved to the backlog in
   `specs/admin-console.md` §10, and that pressure is the point.

   Carry a debt's **original date**, never today's. Age is the whole value of the list: an item
   carried for five sessions is a decision nobody stated out loud, and retyping it fresh each time
   is what hid that before.

4. **Check `docs/ROADMAP.md` against what landed.** Look for statements that have become **false**,
   not merely incomplete: a question recorded as open that was answered, a blocker that was cleared,
   a "Now" item that shipped. A stale map misinforms the next session rather than merely aging.
5. **Archive what aged, and audit it on the way out.** ROADMAP holds at most three `## Done`
   sections. When this session's section makes a fourth, the oldest moves to `docs/history/`.

   Moving it silently is the failure this step exists to prevent. For each lesson in the section
   being archived, ask one question: **is this now carried by a gate, by a rule in a `CLAUDE.md` or
   in the DoD — or by nothing?** A lesson carried by nothing was never protecting anything, and this
   is the moment that stops being invisible. Either write the rule, or record the gap as a debt in
   STATE. Say which you did.

6. Check whether `docs/CONTRIBUTING.md` requires a journal entry: it does when the session produced
   **no PR**. A session that opened one documents itself in the PR description. It also does,
   regardless of how many PRs there were, when a lesson of the session fits in none of them —
   anything about _how_ the work went rather than _what_ changed has no PR to live in, and is lost
   by default.
7. **What was verified by hand?** List every check this session performed manually: a migration
   applied with `psql`, a script run from a terminal, a screen looked at, a query pasted into a
   dashboard. For each, say which of two things it became — a check something else now runs, or a
   debt in STATE where the next person will meet it. A verification that lives only in a transcript
   has already expired.
8. **What did this session make stale?** A new column, a newly required argument, a new migration
   makes something elsewhere out of date: fixtures, hand-maintained lists, seed data, snapshots, the
   ledger repair script. Name the files that have to move together with what changed, and say
   whether anything now enforces that they do. This catches the failure the previous two steps
   cannot: a gate that is green because nothing executes the thing that would have gone red.

Then reply with, in the language the user speaks to you:

- **What landed** — 3-5 lines. Commits, PRs, decisions taken.
- **STATE** — the rewritten file, in full. It is short enough to read in the reply, and it is the
  document every future session starts from, so it gets read before it is written.
- **Map corrections** — the exact ROADMAP edits you propose, as a diff, or "none needed" with the
  reason. Nothing vague: quote the sentence that is now wrong.
- **Archived** — which section moved to `docs/history/`, and for each lesson in it, what carries it
  now. "Nothing" is a permitted answer and becomes a debt.
- **Journal** — either a drafted entry for `docs/journal/<name>-<date>.md` (what was tried, what was
  learned, what was abandoned and why), or why the rule does not require one.
- **Verified by hand** — the list from step 7, each item ending in a mechanism or in a debt. "Checked
  and it was fine" is not an outcome; it is the state that expires overnight.

Do not write any file until the user approves. Then write only what they approved, and commit it
separately from any code — a documentation correction should be readable on its own in the log.
