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
   **no PR**. A session that opened one documents itself in the PR description.

Then reply with, in the language the user speaks to you:

- **What landed** — 3-5 lines. Commits, PRs, decisions taken.
- **Map corrections** — the exact ROADMAP edits you propose, as a diff, or "none needed" with the
  reason. Nothing vague: quote the sentence that is now wrong.
- **Journal** — either a drafted entry for `docs/journal/<name>-<date>.md` (what was tried, what
  was learned, what was abandoned and why), or why the rule does not require one.
- **Left open** — anything a future session would waste time rediscovering: a half-finished branch,
  a decision awaiting an answer, a known gap you chose not to close.

Do not write any file until the user approves. Then write only what they approved, and commit it
separately from any code — a documentation correction should be readable on its own in the log.
