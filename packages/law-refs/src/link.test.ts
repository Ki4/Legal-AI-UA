import { describe, expect, it } from "vitest";
import { normalizeLawLink } from "./link.ts";

/**
 * Unwrap a result that is expected to have succeeded, so a failing case reads
 * as its own assertion rather than as a type error three lines later.
 */
function expectOk(input: string) {
  const result = normalizeLawLink(input);
  if (!result.ok) {
    throw new Error(`expected ${input} to normalize, got ${result.reason}`);
  }
  return result.link;
}

describe("normalizeLawLink", () => {
  it("resolves a plain act link", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/2947-14");

    expect(link.source).toBe("zakon_rada");
    expect(link.actId).toBe("2947-14");
    expect(link.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/2947-14");
    expect(link.strippedRevision).toBeNull();
  });

  // §9.2's pinned-redaction trap, and the reason this function exists at all.
  // The revision is resolved away rather than refused (§9.5.1), and reported so
  // the screen can say what it did.
  it("strips a pinned revision and reports it", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101");

    expect(link.actId).toBe("2947-14");
    expect(link.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/2947-14");
    expect(link.strippedRevision).toBe("20240101");
  });

  it("strips a pinned revision that carries a paragraph anchor after it", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101/paran123");

    expect(link.actId).toBe("2947-14");
    expect(link.strippedRevision).toBe("20240101");
  });

  // The anchor is a fragment, so it never reaches the path — asserted anyway,
  // because "obviously it does not" is how the article ends up parsed out of
  // `#n123` by whoever refactors this next.
  it("ignores the fragment entirely", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/435-15#n1234");

    expect(link.actId).toBe("435-15");
    expect(link.strippedRevision).toBeNull();
  });

  it("drops print and conversion views", () => {
    expect(expectOk("https://zakon.rada.gov.ua/laws/show/435-15/print").actId).toBe("435-15");
    expect(expectOk("https://zakon.rada.gov.ua/laws/show/435-15/conv").actId).toBe("435-15");
  });

  // §9.3 is only true if two links to one norm produce one row. A mirror host
  // is the cheapest way for that to stop being true.
  it("resolves a mirror host to the canonical one", () => {
    const link = expectOk("https://zakon2.rada.gov.ua/laws/show/2947-14");

    expect(link.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/2947-14");
  });

  it("accepts http and a www prefix", () => {
    expect(expectOk("http://www.zakon.rada.gov.ua/laws/show/2947-14").actId).toBe("2947-14");
  });

  it("lowercases the identifier, because case is not a second norm", () => {
    expect(expectOk("https://zakon.rada.gov.ua/laws/show/Z0123-19").actId).toBe("z0123-19");
  });

  // The Constitution. Two path segments, Cyrillic in both halves, and the
  // shape that breaks every "take the segment after show" parser.
  it("keeps a two-segment identifier whole", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/254к/96-вр");

    expect(link.actId).toBe("254к/96-вр");
    expect(link.canonicalUrl).toBe("https://zakon.rada.gov.ua/laws/show/254к/96-вр");
  });

  it("reads a percent-encoded identifier as its characters", () => {
    const link = expectOk("https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80");

    expect(link.actId).toBe("254к/96-вр");
  });

  it("keeps an international-treaty identifier, which carries no dash", () => {
    expect(expectOk("https://zakon.rada.gov.ua/laws/show/995_004").actId).toBe("995_004");
  });

  it("tolerates a trailing slash and surrounding whitespace", () => {
    expect(expectOk("  https://zakon.rada.gov.ua/laws/show/2947-14/  ").actId).toBe("2947-14");
  });

  describe("refusals", () => {
    it("refuses what is not a URL", () => {
      expect(normalizeLawLink("Сімейний кодекс, ст. 105")).toEqual({
        ok: false,
        reason: "not_a_url",
      });
    });

    it("refuses an empty string", () => {
      expect(normalizeLawLink("")).toEqual({ ok: false, reason: "not_a_url" });
    });

    it("refuses a source this platform does not watch", () => {
      expect(normalizeLawLink("https://reyestr.court.gov.ua/Review/12345")).toEqual({
        ok: false,
        reason: "unknown_source",
      });
    });

    // A host that merely ends in the right thing is not the right host.
    it("refuses a lookalike host", () => {
      expect(normalizeLawLink("https://zakon.rada.gov.ua.example.com/laws/show/2947-14")).toEqual({
        ok: false,
        reason: "unknown_source",
      });
    });

    it("refuses the right host on the wrong kind of page", () => {
      expect(normalizeLawLink("https://zakon.rada.gov.ua/rada/show/v0001")).toEqual({
        ok: false,
        reason: "not_an_act_url",
      });
      expect(normalizeLawLink("https://zakon.rada.gov.ua/")).toEqual({
        ok: false,
        reason: "not_an_act_url",
      });
    });

    it("refuses an act page with no identifier left after the views are peeled", () => {
      expect(normalizeLawLink("https://zakon.rada.gov.ua/laws/show/print")).toEqual({
        ok: false,
        reason: "unparsable_act_id",
      });
    });

    // Refusing beats guessing: a third segment folded into the identifier would
    // build a canonical URL that resolves to nothing, and the register would
    // hold a norm that looks watched.
    it("refuses more identifier segments than an act has", () => {
      expect(normalizeLawLink("https://zakon.rada.gov.ua/laws/show/254к/96-вр/extra")).toEqual({
        ok: false,
        reason: "unparsable_act_id",
      });
    });

    it("refuses an identifier carrying characters no act identifier has", () => {
      expect(normalizeLawLink("https://zakon.rada.gov.ua/laws/show/2947 14")).toEqual({
        ok: false,
        reason: "unparsable_act_id",
      });
    });
  });
});
