import { describe, expect, it } from "vitest";
import { normalizeArticle } from "./article.ts";

describe("normalizeArticle", () => {
  it("passes a bare number through", () => {
    expect(normalizeArticle("105")).toEqual({ ok: true, article: "105" });
  });

  it("keeps the inserted-article suffix", () => {
    expect(normalizeArticle("75-1")).toEqual({ ok: true, article: "75-1" });
  });

  it("strips the word, in every spelling a lawyer types", () => {
    for (const typed of [
      "ст. 105",
      "ст 105",
      "Стаття 105",
      "статті 105",
      "Article 105",
      "art.105",
    ]) {
      expect(normalizeArticle(typed)).toEqual({ ok: true, article: "105" });
    }
  });

  // The alternation has to try `стаття` before `ст`, or this leaves `аття 105`
  // behind and refuses the one input the rule exists to accept.
  it("strips the full word rather than its first two letters", () => {
    expect(normalizeArticle("стаття 75-1")).toEqual({ ok: true, article: "75-1" });
  });

  // `75¹` and `75-1` are one article written two ways. Two rows would be two
  // norms watched separately, which §9.3 exists to prevent.
  it("reads a superscript as the suffix it means", () => {
    expect(normalizeArticle("ст. 75¹")).toEqual({ ok: true, article: "75-1" });
    expect(normalizeArticle("75¹²")).toEqual({ ok: true, article: "75-12" });
  });

  it("normalizes a pasted en dash and the spacing around it", () => {
    expect(normalizeArticle("75 – 1")).toEqual({ ok: true, article: "75-1" });
    expect(normalizeArticle("75 -1")).toEqual({ ok: true, article: "75-1" });
    expect(normalizeArticle("75−1")).toEqual({ ok: true, article: "75-1" });
  });

  it("drops a trailing full stop", () => {
    expect(normalizeArticle("ст. 105.")).toEqual({ ok: true, article: "105" });
  });

  describe("refusals", () => {
    it("refuses blank input, separately from unrecognized", () => {
      expect(normalizeArticle("")).toEqual({ ok: false, reason: "blank" });
      expect(normalizeArticle("   ")).toEqual({ ok: false, reason: "blank" });
    });

    it("refuses the word with no number after it", () => {
      expect(normalizeArticle("стаття")).toEqual({ ok: false, reason: "unrecognized" });
    });

    // §9.4 fixes the article as the tracked unit. A part belongs in the
    // `relied_on` sentence, not in a field nothing fetches at that granularity.
    it("refuses a part-and-article phrase rather than guessing which is which", () => {
      expect(normalizeArticle("частина 3 статті 75")).toEqual({
        ok: false,
        reason: "unrecognized",
      });
    });

    it("refuses prose", () => {
      expect(normalizeArticle("десь у розділі про шлюб")).toEqual({
        ok: false,
        reason: "unrecognized",
      });
    });
  });
});
