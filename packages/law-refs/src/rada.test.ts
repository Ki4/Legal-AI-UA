// Asserted against real pages, not against imagined ones.
//
// The files under `fixtures/` came off zakon.rada.gov.ua on 2026-08-30; their
// provenance and how to refresh them is in `fixtures/README.md`. They arrive
// through Vite's `?raw` import rather than `node:fs`, so that this package keeps
// neither dependencies nor Node types — see `fixtures.d.ts` for why that is
// worth a declaration file.

import { describe, expect, it } from "vitest";
import PRINT from "../fixtures/zakon-rada-2947-14-print-excerpt.html?raw";
import SHELL from "../fixtures/zakon-rada-2947-14-shell.html?raw";
import OTHER_SHELL from "../fixtures/zakon-rada-1404-19-shell.html?raw";
import { extractArticle, extractRedactionDate, printUrl } from "./rada.ts";
import { normalizeArticleText } from "./text.ts";

function reduced(html: string, article: string): string {
  const extracted = extractArticle(html, article);
  if (!extracted.ok) throw new Error(`expected an extraction, got ${extracted.reason}`);

  const normalized = normalizeArticleText(extracted.text);
  if (!normalized.ok) throw new Error(`expected usable text, got ${normalized.reason}`);

  return normalized.text;
}

describe("printUrl", () => {
  // The finding that changed the design: the page the register points at is a
  // JavaScript shell with no article in it. Fetching `canonical_url` and
  // extracting would have produced an empty result for every norm we hold.
  it("sends the fetcher to the page that actually carries text", () => {
    expect(printUrl("https://zakon.rada.gov.ua/laws/show/2947-14")).toBe(
      "https://zakon.rada.gov.ua/laws/show/2947-14/print",
    );
  });

  it("does not double the separator on a url that ends in one", () => {
    expect(printUrl("https://zakon.rada.gov.ua/laws/show/2947-14/")).toBe(
      "https://zakon.rada.gov.ua/laws/show/2947-14/print",
    );
  });

  // Proven against the fixture rather than asserted: the shell really does carry
  // no article text, which is why the print page exists at all.
  it("is needed, because the shell page has no article heading in it", () => {
    expect(extractArticle(SHELL, "105")).toEqual({ ok: false, reason: "heading_missing" });
  });
});

describe("extractRedactionDate", () => {
  it("reads the date the act's own page states", () => {
    expect(extractRedactionDate(SHELL)).toEqual({ ok: true, date: "2026-08-05" });
  });

  // A second act, so that "the date lives in span.dat0" is a pattern rather than
  // a coincidence found once. This is the cheap probe of §9.7: 34 KB carrying a
  // date that moves only when the act is amended, against 547 KB of text.
  it("reads it the same way on a different act", () => {
    expect(extractRedactionDate(OTHER_SHELL)).toEqual({ ok: true, date: "2026-05-23" });
  });

  // §9.15 condition 1. An unreadable date is `unreachable`, never a norm that
  // quietly carries on undated.
  it("refuses a page that states no date, rather than inventing one", () => {
    expect(extractRedactionDate("<html><body><p>Нічого</p></body></html>")).toEqual({
      ok: false,
      reason: "revision_date_unparsable",
    });
  });
});

describe("extractArticle — against the real print page", () => {
  it("returns the article a lawyer asked for, title and all", () => {
    const text = reduced(PRINT, "105");

    expect(text.startsWith("Стаття 105. Припинення шлюбу внаслідок його розірвання")).toBe(true);
    expect(text).toContain(
      "Шлюб припиняється внаслідок його розірвання за спільною заявою подружжя",
    );
  });

  // The boundary between one article and the next, which is the whole of what
  // "extract an article" means on a page holding a hundred of them.
  it("stops where the next article begins", () => {
    const text = reduced(PRINT, "105");

    expect(text).not.toContain("Стаття 106");
    expect(text).not.toContain("Стаття 104");
  });

  it("does not pick up the page's own furniture", () => {
    const text = reduced(PRINT, "105");

    expect(text).not.toContain("Друкувати");
    expect(text).not.toContain("script");
  });

  // The last article of an act ends at the end of the document rather than at
  // another heading. Every act has exactly one article in that position, so it
  // is a case the parser meets on every source it ever reads.
  it("reads the last article in the document, which no heading follows", () => {
    const text = reduced(PRINT, "109");

    expect(text.startsWith("Стаття 109.")).toBe(true);
    expect(text.length).toBeGreaterThan(100);
  });

  // §9.7's decision, now visible on real text: the inline `{...}` notes are how
  // this publisher records an amendment, so one appearing is the event being
  // watched for rather than noise to be stripped.
  it("keeps the inline amendment footnote the publisher writes into the text", () => {
    const text = reduced(PRINT, "105");

    expect(text).toContain("{Частина перша статті 105 в редакції Закону");
  });

  it("keeps paragraph structure instead of welding the article into one line", () => {
    const text = reduced(PRINT, "105");

    expect(text.split("\n").length).toBeGreaterThan(3);
  });

  // The assertion above cannot carry this rule alone, and the probe is what said
  // so. The publisher's markup is indented, so its source already holds a
  // newline between every pair of paragraphs -- which means a parser that
  // stripped tags *before* turning block ends into breaks still returns plenty
  // of lines, and the count above stays green while every break the parser was
  // supposed to make has been lost. The markup here is one physical line on
  // purpose: every newline in the result had to come from a `</p>`, so the
  // assertion depends on the ordering rather than on the fixture's whitespace.
  it("makes the breaks itself, on markup that carries no newlines of its own", () => {
    const oneLine =
      "<p><span class=rvts9>Стаття 8.</span> Назва</p>" +
      "<p>Перший абзац статті.</p>" +
      "<p>Другий абзац статті.</p>";

    expect(reduced(oneLine, "8").split("\n")).toEqual([
      "Стаття 8. Назва",
      "Перший абзац статті.",
      "Другий абзац статті.",
    ]);
  });

  it("decodes the entities the publisher's markup uses", () => {
    const text = reduced(PRINT, "105");

    expect(text).not.toContain("&nbsp;");
    expect(text).not.toContain("&mdash;");
    expect(text).not.toMatch(/&[a-z]+;/u);
  });

  // Every article in the excerpt, so the parse is a rule rather than one lucky
  // slice. 103 to 109 are what the fixture holds.
  it("reads every article in the excerpt", () => {
    for (const article of ["103", "104", "105", "106", "107", "108", "109"]) {
      const text = reduced(PRINT, article);
      expect(text.startsWith(`Стаття ${article}.`)).toBe(true);
    }
  });
});

describe("extractArticle — the assertions of §9.15 condition 1", () => {
  // The sharpening this parser prompted. "A heading was found" proves the parser
  // read *an* article, not *the* article — and §9.13 names renumbering as a
  // thing that happens, so a parser satisfied by presence would follow the
  // neighbouring provision forever and report perfect stability.
  it("refuses an article the document does not contain, and says which failure it was", () => {
    expect(extractArticle(PRINT, "999")).toEqual({ ok: false, reason: "heading_mismatch" });
  });

  it("distinguishes that from a document with no articles at all", () => {
    expect(extractArticle("<html><body><p>Нічого</p></body></html>", "105")).toEqual({
      ok: false,
      reason: "heading_missing",
    });
  });

  it("refuses an article designator it cannot read", () => {
    expect(extractArticle(PRINT, "десь про шлюб")).toEqual({
      ok: false,
      reason: "heading_mismatch",
    });
  });

  // What a parser looks like when the publisher moves the text and leaves the
  // heading: a match, and nothing behind it. Never "no change".
  it("refuses a heading with nothing under it", () => {
    const hollow = "<p><span class=rvts9>Стаття 105.</span></p>";

    expect(extractArticle(hollow, "105")).toEqual({ ok: false, reason: "text_blank" });
  });

  // The publisher serves `class=rvts9` unquoted, which is valid HTML. Both forms
  // are accepted so that a template tidy-up does not read as every article on
  // the platform vanishing on the same morning.
  it("reads the heading whether or not the class attribute is quoted", () => {
    const quoted = '<p><span class="rvts9">Стаття 7.</span> Назва</p><p>Текст статті сім.</p>';

    expect(extractArticle(quoted, "7")).toEqual({
      ok: true,
      text: expect.stringContaining("Текст статті сім."),
    });
  });

  // `75-1` and `75¹` are one article written two ways, and the heading is
  // normalized through the same function the lawyer's input goes through — so
  // the two sides cannot disagree about which article was asked for.
  it("matches a superscript heading against the number a lawyer typed", () => {
    const inserted = "<p><span class=rvts9>Стаття 75¹.</span> Назва</p><p>Текст статті.</p>";

    expect(extractArticle(inserted, "75-1")).toEqual({
      ok: true,
      text: expect.stringContaining("Текст статті."),
    });
  });
});
