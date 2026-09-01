import { describe, expect, it } from "vitest";
import {
  fingerprintArticleText,
  fingerprintRevision,
  MIN_PLAUSIBLE_ARTICLE_LENGTH,
  NORMALIZER_VERSION,
  normalizeArticleText,
} from "./text.ts";

/** Long enough to clear the plausibility floor without saying anything about the rule under test. */
const BODY = "Шлюб розривається судом за заявою одного з подружжя.";

/**
 * Characters this module exists to remove, written by code point.
 *
 * A test for a character you cannot see is a test nobody can check by reading —
 * and one that passes silently if an editor, a terminal or a patch tool eats the
 * character on its way into the file. So the invisible ones are constructed
 * rather than pasted. The visible ones below are left as themselves, because
 * there a reader can see what is being asserted.
 */
const CHAR = {
  softHyphen: String.fromCodePoint(0x00ad),
  zeroWidthSpace: String.fromCodePoint(0x200b),
  bom: String.fromCodePoint(0xfeff),
  nbsp: String.fromCodePoint(0x00a0),
  narrowNbsp: String.fromCodePoint(0x202f),
  combiningBreve: String.fromCodePoint(0x0306),
} as const;

function normalized(input: string): string {
  const result = normalizeArticleText(input);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.text;
}

describe("normalizeArticleText", () => {
  it("passes clean text through unchanged", () => {
    expect(normalized(BODY)).toBe(BODY);
  });

  it("collapses the indentation and trailing spaces markup leaves behind", () => {
    expect(normalized(`    ${BODY}   `)).toBe(BODY);
    expect(normalized("Шлюб    розривається судом    за заявою одного з подружжя.")).toBe(BODY);
  });

  // The text is stored to be read by a lawyer triaging a diff (§9.7). One long
  // line would fingerprint identically and read appallingly.
  it("keeps paragraphs apart while collapsing runs of blank lines", () => {
    expect(normalized(`${BODY}\n\n\n\n${BODY}`)).toBe(`${BODY}\n\n${BODY}`);
  });

  it("normalizes line endings, so a publisher switching to CRLF is not an amendment", () => {
    expect(normalized(`${BODY}\r\n${BODY}`)).toBe(`${BODY}\n${BODY}`);
  });

  // The two unicode line breaks are the nastiest members of this family: they
  // are invisible, they are whitespace, and `split("\n")` does not see them — so
  // an untreated one rides into the stored text *and* stops the line around it
  // from being trimmed. Both halves are asserted, because treating it as a line
  // break and merely deleting it are different fixes and only one is right.
  it("treats the unicode line and paragraph separators as line breaks", () => {
    const lineSeparator = String.fromCodePoint(0x2028);
    const paragraphSeparator = String.fromCodePoint(0x2029);

    expect(normalized(`${BODY}${lineSeparator}  ${BODY}`)).toBe(`${BODY}\n${BODY}`);
    expect(normalized(`${BODY}${paragraphSeparator}${BODY}`)).toBe(`${BODY}\n${BODY}`);
  });

  it("removes invisible characters", () => {
    const withNoise = `${CHAR.bom}Шлюб${CHAR.softHyphen} розривається${CHAR.zeroWidthSpace} судом за заявою.`;
    expect(normalized(withNoise)).toBe("Шлюб розривається судом за заявою.");
  });

  it("reduces exotic spaces to a space", () => {
    const withNoise = `Шлюб${CHAR.nbsp}розривається${CHAR.narrowNbsp}судом за заявою одного.`;
    expect(normalized(withNoise)).toBe("Шлюб розривається судом за заявою одного.");
  });

  it("reduces every dash variant to one, and every quote style to one", () => {
    expect(normalized("Шлюб — це союз «чоловіка» та “жінки”.")).toBe(
      'Шлюб - це союз "чоловіка" та "жінки".',
    );
  });

  // A composed and a decomposed `й` are the same letter, and only one of them
  // survives a copy through some editors. Without NFC the two fingerprint apart
  // and the norm drifts on a difference no reader can see.
  it("normalizes unicode composition", () => {
    const composed = "Подружжя майже завжди укладає договір.";
    const decomposed = composed.replace("й", `и${CHAR.combiningBreve}`);

    expect(decomposed).not.toBe(composed);
    expect(normalized(decomposed)).toBe(normalized(composed));
  });

  describe("what is deliberately left alone", () => {
    // A defined term is capitalized on purpose, and lowercasing would hide the
    // amendment that stops a word being a defined term.
    it("does not touch case", () => {
      expect(normalized(`СТОРОНИ договору. ${BODY}`)).toBe(`СТОРОНИ договору. ${BODY}`);
    });

    // These look like noise and are the event being watched for.
    it("keeps the inline amendment footnotes rada carries", () => {
      const withFootnote = `${BODY}\n{ Статтю доповнено згідно із Законом N 2947-14 }`;
      expect(normalized(withFootnote)).toBe(withFootnote);
    });
  });

  describe("refusals — §9.15 condition 2", () => {
    it("refuses empty and whitespace-only extraction as blank", () => {
      expect(normalizeArticleText("")).toEqual({ ok: false, reason: "blank" });
      expect(normalizeArticleText("   \n\n \t ")).toEqual({ ok: false, reason: "blank" });
    });

    // Markup that returns something is the harder failure, and it is counted
    // separately from markup that returns nothing.
    it("refuses an extraction below the plausibility floor, distinctly from blank", () => {
      expect(normalizeArticleText("Стаття 15")).toEqual({
        ok: false,
        reason: "implausibly-short",
      });
    });

    // Both halves of the rule, one character apart: the floor has to admit real
    // text as surely as it refuses empty markup, or it is a rule that fails in
    // the direction §9.15 is least able to see.
    it("admits text exactly at the floor and refuses text one character below", () => {
      const atFloor = "я".repeat(MIN_PLAUSIBLE_ARTICLE_LENGTH);
      const belowFloor = "я".repeat(MIN_PLAUSIBLE_ARTICLE_LENGTH - 1);

      expect(normalizeArticleText(atFloor)).toEqual({ ok: true, text: atFloor });
      expect(normalizeArticleText(belowFloor)).toEqual({
        ok: false,
        reason: "implausibly-short",
      });
    });

    // The length that counts is the reduced one. Markup padding a stub with
    // non-breaking spaces would otherwise walk it over the floor and be stored
    // as though it were an article.
    it("measures the floor after normalization, not before", () => {
      const padded = `${CHAR.nbsp.repeat(8)}Виключена.${CHAR.nbsp.repeat(8)}`;
      expect(padded.length).toBeGreaterThan(MIN_PLAUSIBLE_ARTICLE_LENGTH);
      expect(normalizeArticleText(padded)).toEqual({ ok: false, reason: "implausibly-short" });
    });
  });
});

describe("fingerprintArticleText", () => {
  it("is the algorithm prefix and lowercase hex, the shape seed.sql already writes", async () => {
    expect(await fingerprintArticleText(BODY)).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("is stable across calls", async () => {
    expect(await fingerprintArticleText(BODY)).toBe(await fingerprintArticleText(BODY));
  });

  it("moves when the text moves", async () => {
    expect(await fingerprintArticleText(BODY)).not.toBe(
      await fingerprintArticleText(`${BODY} Зміна.`),
    );
  });

  // The whole point of normalizing first: two spellings of one text are one
  // fingerprint, so a reflowed page is not a drift a lawyer has to triage.
  it("agrees for two spellings of the same normalized text", async () => {
    const reflowed = "  Шлюб — це союз «чоловіка» та “жінки”.  ";
    const plain = 'Шлюб - це союз "чоловіка" та "жінки".';

    expect(reflowed).not.toBe(plain);
    expect(await fingerprintArticleText(normalized(reflowed))).toBe(
      await fingerprintArticleText(normalized(plain)),
    );
  });

  // A known vector, so that a refactor of the hex encoding cannot pass by
  // agreeing with itself. sha256 of the empty string.
  it("matches a known digest", async () => {
    expect(await fingerprintArticleText("")).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("fingerprintRevision", () => {
  it("produces the three values one revision row needs, agreeing with each other", async () => {
    const result = await fingerprintRevision(`  ${BODY}  `);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);

    expect(result.revision.text).toBe(BODY);
    expect(result.revision.fingerprint).toBe(await fingerprintArticleText(BODY));
    expect(result.revision.normalizerVersion).toBe(NORMALIZER_VERSION);
  });

  // The whole reason this function exists. Hashing the raw extraction is one
  // plausible mistake away when the primitives sit side by side, it raises
  // nothing and returns a perfectly well-formed hash — of the wrong thing. The
  // two values differing is what makes the mistake worth preventing, so it is
  // asserted rather than described.
  it("fingerprints the reduction and not the raw input, which are different values", async () => {
    const raw = `\r\n   ${BODY}   \r\n`;
    const result = await fingerprintRevision(raw);
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);

    expect(await fingerprintArticleText(raw)).not.toBe(result.revision.fingerprint);
    expect(result.revision.fingerprint).toBe(await fingerprintArticleText(result.revision.text));
  });

  // A refused extraction has no fingerprint at all, rather than a hash of
  // nothing that a later comparison would happily treat as an article (§9.15).
  it("carries the refusal through, with no fingerprint attached", async () => {
    expect(await fingerprintRevision("   ")).toEqual({ ok: false, reason: "blank" });
    expect(await fingerprintRevision("Стаття 15")).toEqual({
      ok: false,
      reason: "implausibly-short",
    });
  });
});

describe("NORMALIZER_VERSION", () => {
  // The migration defaults `law_norms.normalizer_version` to this number. If the
  // rules above change, both move together — otherwise the fingerprints stored
  // under the old rules are indistinguishable from the ones stored under the new
  // ones, and the whole point of keeping the version is lost.
  it("matches the default in the register migration", () => {
    expect(NORMALIZER_VERSION).toBe(1);
  });
});
