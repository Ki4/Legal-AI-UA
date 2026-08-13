---
description: Close a session — propose the journal entry and any map corrections, for approval
---

The mirror of `/session-start`. Nothing here writes without the user agreeing to it first: a
document nobody read is worse in the permanent record than a document nobody wrote.

Gather, then propose:

1. Run `git log --oneline <since the session began>` and `git status`. If the start point is
   unclear, use `git log --oneline -15` and ask which commits belong to this session.
2. Run `pnpm docs:check`. Anything it reports is a fact, not an opinion — fix it before proposing
   anything else.
3. Read `docs/ROADMAP.md` and check it against what actually landed. Look specifically for
   statements that have become **false**, not merely incomplete: a question recorded as open that
   was answered, a blocker that was cleared, a "Now" item that shipped. This is the failure this
   command exists for — a stale map misinforms the next session rather than merely aging.
4. Check whether `docs/CONTRIBUTING.md` requires a journal entry: it does when the session produced
   **no PR**. A session that opened one documents itself in the PR description. It also does,
   regardless of how many PRs there were, when a lesson of the session fits in none of them —
   anything about _how_ the work went rather than _what_ changed has no PR to live in, and is lost
   by default.
5. **What was verified by hand?** List every check this session performed manually: a migration
   applied with `psql`, a script run from a terminal, a screen looked at, a query pasted into a
   dashboard. For each, say which of two things it became — a check something else now runs, or a
   gap recorded where the next person will meet it. A verification that lives only in a transcript
   has already expired.
6. **What did this session make stale?** A new column, a newly required argument, a new migration
   makes something elsewhere out of date: fixtures, hand-maintained lists, seed data, snapshots,
   the ledger repair script. Name the files that have to move together with what changed, and say
   whether anything now enforces that they do. This catches the failure the previous two steps
   cannot: a gate that is green because nothing executes the thing that would have gone red.

Then reply with, in the language the user speaks to you:

- **What landed** — 3-5 lines. Commits, PRs, decisions taken.
- **Map corrections** — the exact ROADMAP edits you propose, as a diff, or "none needed" with the
  reason. Nothing vague: quote the sentence that is now wrong.
- **Journal** — either a drafted entry for `docs/journal/<name>-<date>.md` (what was tried, what
  was learned, what was abandoned and why), or why the rule does not require one.
- **Verified by hand** — the list from step 5, each item ending in a mechanism or in a recorded
  gap. "Checked and it was fine" is not an outcome; it is the state that expires overnight.
- **Left open** — anything a future session would waste time rediscovering: a half-finished branch,
  a decision awaiting an answer, a known gap you chose not to close.

Do not write any file until the user approves. Then write only what they approved, and commit it
separately from any code — a documentation correction should be readable on its own in the log.
