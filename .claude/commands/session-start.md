---
description: Orient a fresh session — where we are, what's done, what to pick up next
---

Build a session briefing. Do all of the following, then summarize:

1. Run `git log --oneline -15` and `git status` — recent history and current working tree.
2. Read `docs/ROADMAP.md` — the map: what exists, what's in the current wave.
3. Read `docs/specs/admin-console.md` §13 (decisions taken) and §14 (open questions) — the
   decisions already made, and the ones blocking work. Do not re-open a settled one.
4. Read `docs/specs/console-feature-dod.md` §1–§8 if the likely next task is a console feature —
   that is what review will hold it to.
5. Run `gh issue list --state open --limit 30` — the live status board. If `gh` is unavailable or
   unauthenticated, say so in one line and move on; the backlog in the spec is the fallback.
6. Read the most recent file in `docs/journal/` — conclusions, dead ends, open questions. Note its
   date: entries exist only for sessions that produced no PR, so recent work may have left none.
7. Check `docs/adr/` for any ADR newer than the last journal entry — decisions made since.

Then reply with a briefing in this shape, in the language the user speaks to you:

- **Where we are** — 2-3 sentences: current wave, what landed most recently.
- **In flight** — open issues assigned to this person (or unassigned ones in their zone), plus any
  unmerged branch that looks like work in progress.
- **Blocked on a decision** — any open question from §14 that stops the next task from starting.
  Name the question, not the topic.
- **Suggested next task** — one concrete item with its acceptance criteria, respecting zone
  ownership from `docs/CONTRIBUTING.md`.
- **Watch out** — anything from the journal/ADRs that changes how work should proceed (new rules,
  fresh traps, pending reviews blocking others).

Keep the briefing under half a screen. Do not start any task until the user picks one.
