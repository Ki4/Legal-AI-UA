# State — 2026-08-28, the gates have a gate, and the debt list is empty

Written at `8a6a1b9` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1, and its verification stopped being a habit. `pnpm probes` went from ten probes to fifty-two,
runs as its own CI job beside `verify`, has two probes watched by `tsc` because the bridge they break
is a type, and now reports whether it put every patched file back. **ADM-3 is closed**, five passes
of five, and the by-hand drift list is empty for the first time since the mechanism existed.

## In flight

- Nothing. `main` is clean; #59 and #60 merged today and both branches are gone.

## Blocking — the question, and what it stops

- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

Three sessions have closed without §14 moving — a fact about what keeps getting chosen instead.

## Debts — carried since

**Empty, and that is a claim worth distrusting.** The list emptied because two debts got mechanisms
and two got decisions, not because nothing is owed. What replaced them:

- The access-control review is **a standing condition, not a debt**: `CONTRIBUTING.md` suspends the
  second-reviewer rule against a named substitute until there is a second developer. Recorded as a
  debt on 2026-08-04 and carried for 24 days, which was 24 days of re-reading a decision that had
  already been made. It returns to this list the day somebody else can read them.
- The anatomy screen was looked at on 2026-08-28 — signed in, both themes, local stack, after its
  data path moved, which is what the debt was about. What it found is backlog, not debt: hardcoded
  English against DoD §6, `template` rendering as "Confirmed by lawyer", and `selected_by` and
  `tool_calls` carried by the trace and rendered nowhere.

## Next candidates

1. **The anatomy screen's three findings.** The copy one is a DoD §6 violation and the cheapest;
   the trust wording needs a lawyer; the missing conditions and tool calls are half of what the
   screen is for.
2. **`document_blocks` (ADM-1's remainder).** It waited on the trace schema because the two
   constrain each other's shape; that shape has been frozen since 2026-08-28.
3. **The Edge Function gateway skeleton (ADM-5).** JWT → rights → audit → core call — what the job
   protocol was written for, and what turns ADR-0021 §8's Deno claim into a verified fact.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
