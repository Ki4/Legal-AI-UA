// Mechanical drift checks for the documentation, as a function so both the
// `pnpm docs:check` CLI and the SessionStart hook can use it without one
// shelling out to the other.
//
// These exist because of a specific failure: docs/ROADMAP.md claimed the
// one-off-versus-subscription question was still open long after it was
// answered, and nothing said so. A person noticed by accident. Everything
// checked here is decidable without judgement — a link that does not resolve, a
// cross-reference to a section that does not exist. Whether prose is still
// *true* stays a reader's job; a check that fires for a defensible reason
// teaches people to ignore checks.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo", "supabase"]);

function markdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, found);
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

export function checkDocs(root) {
  const problems = [];
  const notes = [];
  const fail = (file, message) => problems.push(`${relative(root, file)}: ${message}`);

  const files = markdownFiles(root);
  const contents = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

  // 1. Relative links resolve.
  for (const [file, text] of contents) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      try {
        statSync(resolve(dirname(file), target.split("#")[0]));
      } catch {
        fail(file, `link points at a file that does not exist: ${target}`);
      }
    }
  }

  // 2. Section cross-references resolve inside their own document. Renumbering
  //    is the usual way these rot: §9.4 keeps pointing at the number it had
  //    before something was inserted above it.
  //
  //    Both heading forms are in use: `## 9. Law monitoring` carries a trailing
  //    dot, `### 9.4 Article level` does not.
  //
  //    Limit worth knowing: a document that does not number its sections is
  //    skipped entirely, so a stray §-reference in ROADMAP goes unnoticed.
  for (const [file, text] of contents) {
    const sections = new Set();
    for (const match of text.matchAll(/^#{2,6}\s+(\d+(?:\.\d+)*)[.\s]/gm)) sections.add(match[1]);
    if (sections.size === 0) continue;

    for (const match of text.matchAll(/§(\d+(?:\.\d+)?)/g)) {
      if (!sections.has(match[1])) fail(file, `cross-reference §${match[1]} has no such section`);
    }
  }

  // 3. Every backlog id mentioned is also defined by a table row.
  for (const [file, text] of contents) {
    const mentioned = new Set([...text.matchAll(/\bADM-(\d+)\b/g)].map((m) => m[1]));
    if (mentioned.size === 0) continue;

    const defined = new Set([...text.matchAll(/^\|\s*ADM-(\d+)\s*\|/gm)].map((m) => m[1]));
    if (defined.size === 0) continue; // a doc that only cites ids defined elsewhere

    for (const id of mentioned) {
      if (!defined.has(id)) fail(file, `ADM-${id} is referenced but has no row in any table`);
    }
  }

  // 4. No ADR is orphaned. A decision nobody links to is one nobody will find.
  //    A note rather than a failure: several predate the habit.
  const adrDir = join(root, "docs", "adr");
  for (const entry of readdirSync(adrDir)) {
    const number = /^(\d{4})-/.exec(entry)?.[1];
    if (!number) continue;

    const needle = new RegExp(`ADR-${number}\\b`);
    const cited = [...contents].some(([file, text]) => !file.endsWith(entry) && needle.test(text));
    if (!cited) notes.push(`docs/adr/${entry}: nothing else in the docs mentions ADR-${number}`);
  }

  // 5. The tier-1 documents stay small enough to be read on every cold start.
  //
  //    This is a size budget, which is an unusual thing for a docs check to hold, and the reason it
  //    is here rather than in somebody's habit is the file it was written for. `ROADMAP.md` calls
  //    itself the map — "what exists, what's next" — and by 2026-08-14 it was 435 lines of which 350
  //    were a changelog of finished sessions, because appending a section is easier than moving one.
  //    Nothing was wrong with any individual append. The cost is paid somewhere else entirely: every
  //    session reads the map to orient, and 80% of what it reads is history it will not act on.
  //
  //    A budget makes the pressure land at the moment the section is written instead of on every
  //    reader afterwards. It does not say the history is worthless — it says the history belongs in
  //    `docs/history/`, which is read on request.
  const BUDGETS = [
    {
      file: "docs/STATE.md",
      maxLines: 60,
      hint:
        "STATE is the one document every session reads before anything else. Past 60 lines it stops " +
        "being an orientation and becomes a second roadmap. Close a debt, or move an item to the " +
        "backlog in specs/admin-console.md §10.",
    },
    {
      file: "docs/ROADMAP.md",
      maxLines: 200,
      maxDoneSections: 3,
      hint:
        "Move the oldest `## Done` section to docs/history/. Archive it audited rather than moved: " +
        "for each lesson in it, say whether a gate, a CLAUDE.md rule or the DoD now carries it — a " +
        "lesson carried by nothing was never protecting anything.",
    },
  ];

  for (const budget of BUDGETS) {
    // `contents` is keyed by absolute path. Looking it up by the repo-relative name returned
    // `undefined` on the first run of this check, and `undefined` was being skipped silently — so
    // the budget reported a clean pass while measuring nothing at all. The lookup is resolved now,
    // and a missing file is a failure rather than a skip, which is the half that would have caught
    // it: these two documents are load-bearing for how a session starts, and their absence is not a
    // reason for this check to have no opinion.
    const text = contents.get(resolve(root, budget.file));

    if (text === undefined) {
      problems.push(
        `${budget.file}: missing. A session orients from it; nothing else carries that.`,
      );
      continue;
    }

    const lineCount = text.split(/\r?\n/).length;
    if (lineCount > budget.maxLines) {
      problems.push(
        `${budget.file}: ${lineCount} lines, budget is ${budget.maxLines}. ${budget.hint}`,
      );
    }

    if (budget.maxDoneSections !== undefined) {
      const doneSections = (text.match(/^## Done\b/gm) ?? []).length;
      if (doneSections > budget.maxDoneSections) {
        problems.push(
          `${budget.file}: ${doneSections} \`## Done\` sections, budget is ${budget.maxDoneSections}. ${budget.hint}`,
        );
      }
    }
  }

  // 6. A debt nobody closed for long enough is a decision nobody stated.
  //
  //    A note, never a failure: carrying a debt on purpose is legitimate, and a check that failed on
  //    one would be answered by deleting the line rather than by closing the debt. What it removes is
  //    the invisibility. `TeamPage` had no empty state for three sessions and nobody noticed, because
  //    the list was retyped from scratch into each journal and age was never written down.
  const state = contents.get(resolve(root, "docs/STATE.md"));
  if (state !== undefined) {
    const STALE_DAYS = 21;
    const today = new Date();
    for (const [, iso] of state.matchAll(/^- `(\d{4}-\d{2}-\d{2})`/gm)) {
      const age = Math.floor((today - new Date(iso)) / 86_400_000);
      if (age > STALE_DAYS) {
        notes.push(
          `docs/STATE.md: a debt has been carried since ${iso} (${age} days) — close it or say it is deliberate`,
        );
      }
    }
  }

  // 7. A backlog row does not depend on itself, and the dependencies do not
  //    form a cycle.
  //
  //    The `Depends` column is read to decide what is buildable next, and by
  //    2026-08-27 two rows in it were wrong — an entitlement built on the
  //    document-metadata schema rather than on client identity, and one more
  //    beside it. Neither was catchable: whether ADM-40 *should* depend on
  //    ADM-12 is a judgement about the work, and no script has an opinion about
  //    that.
  //
  //    Two things in that column are not judgements, though. A row that depends
  //    on itself is never buildable, and neither is a cycle — and both look
  //    exactly like ordinary rows to a reader scanning for what to pick up. So
  //    this covers the decidable half and leaves the other half where it was:
  //    with whoever writes the row.
  for (const [file, text] of contents) {
    const dependsOn = new Map();

    for (const [, id, cell] of text.matchAll(/^\|\s*ADM-(\d+)\s*\|[^|]*\|([^|]*)\|/gm)) {
      dependsOn.set(
        id,
        [...cell.matchAll(/ADM-(\d+)/g)].map((m) => m[1]),
      );
    }
    if (dependsOn.size === 0) continue;

    for (const [id, deps] of dependsOn) {
      if (deps.includes(id)) fail(file, `ADM-${id} lists itself as its own dependency`);
    }

    // Depth-first, tracking the path rather than a bare "seen" set: the path is
    // what lets the message name the cycle, and a cycle nobody can name is one
    // nobody fixes.
    const state = new Map();
    const reported = new Set();

    const walk = (id, path) => {
      if (state.get(id) === "done") return;
      if (state.get(id) === "open") {
        const cycle = [...path.slice(path.indexOf(id)), id].map((n) => `ADM-${n}`).join(" → ");
        if (!reported.has(cycle)) {
          reported.add(cycle);
          fail(file, `the Depends column forms a cycle: ${cycle}`);
        }
        return;
      }

      state.set(id, "open");
      for (const dep of dependsOn.get(id) ?? []) walk(dep, [...path, id]);
      state.set(id, "done");
    };

    for (const id of dependsOn.keys()) walk(id, []);
  }

  return { problems, notes, fileCount: files.length };
}
