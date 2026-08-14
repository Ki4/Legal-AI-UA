---
description: Orient a fresh session — where we are, what's done, what to pick up next
---

Build a session briefing. **Read `docs/STATE.md` first and stop there** unless something below says
otherwise. It is tier 1 — the one document written to be read on arrival — and everything else in
`docs/` is tier 2 or 3, read when a task has been chosen and needs it.

That order is the whole design. This command used to read `ROADMAP.md`, two sections of
`specs/admin-console.md`, eight sections of `console-feature-dod.md` and the latest journal — over a
thousand lines to produce ten. Most of it was history that no session acts on.

1. Read `docs/STATE.md`.
2. Run `git log --oneline -10` and `git status`. **Compare against the commit STATE says it was
   written at.** If there are commits after it, STATE is behind: say so in one line and trust git.
   A briefing from a stale state file is worse than no briefing, because it reads as current.
3. Run `gh issue list --state open --limit 30` and `gh pr list --state open`. If `gh` is unavailable
   or unauthenticated, say so in one line and move on.

Stop reading there if STATE and git agree. Read further **only** when the answer requires it:

- `docs/ROADMAP.md` — when the user asks what is next beyond STATE's candidates, or when a
  candidate's place in the waves matters.
- `docs/specs/admin-console.md` §13 and §14 — when a blocking question needs its full text, or
  before re-opening anything. A settled decision is not re-opened.
- `docs/specs/console-feature-dod.md` §1–§8 — when the chosen task is a console feature. That is
  what review will hold it to.
- `docs/history/` and `docs/journal/` — **on request only.** They answer "why is it like this",
  never "what should I do now".
- `docs/adr/` — when a decision's reasoning is in question.

Then reply with a briefing in this shape, in the language the user speaks to you:

- **Where we are** — 2-3 sentences: current wave, what landed most recently.
- **In flight** — open PRs, open issues in this person's zone, any unmerged branch.
- **Blocked on a decision** — from STATE's blocking list. Name the question and what it stops, not
  the topic.
- **Debts worth knowing** — anything in STATE's debt list old enough to matter, with its age. An
  item carried for weeks is a decision nobody stated; say so rather than re-listing it flatly.
- **Suggested next task** — one concrete item with its acceptance criteria, respecting zone
  ownership from `docs/CONTRIBUTING.md`.

Keep the briefing under half a screen. Do not start any task until the user picks one.
