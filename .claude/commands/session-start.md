---
description: Orient a fresh session — where we are, what's done, what to pick up next
---

Build a session briefing. Do all of the following, then summarize:

1. Run `git log --oneline -15` and `git status` — recent history and current working tree.
2. Read `docs/ROADMAP.md` — the map: what's done, what's in the current wave.
3. Run `gh issue list --state open --limit 30` — the live status board. If `gh` is
   unavailable, say so and skip.
4. Read the most recent file in `docs/journal/` — yesterday's conclusions, dead ends,
   open questions.
5. Check `docs/adr/` for any ADR newer than the last journal entry — decisions made
   since.

Then reply with a briefing in this shape, in the language the user speaks to you:

- **Where we are** — 2-3 sentences: current wave, what landed most recently.
- **In flight** — open issues assigned to this person (or unassigned ones in their zone).
- **Suggested next task** — one concrete item with its acceptance criteria, respecting
  zone ownership from `docs/CONTRIBUTING.md`.
- **Watch out** — anything from the journal/ADRs that changes how work should proceed
  (new rules, fresh traps, pending reviews blocking others).

Keep the briefing under half a screen. Do not start any task until the user picks one.
