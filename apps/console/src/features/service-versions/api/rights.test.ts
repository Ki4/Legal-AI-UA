// The who-may-what table of ADR-0027 and §5.7, one line per assertion. The
// schema enforces every one of these; this file asserts the screen offers the
// same set, so a button is neither missing for the person entitled to it nor
// offered to somebody the database would refuse.

import { describe, expect, it } from "vitest";
import { availableActions, type Viewer } from "./rights";
import type { ServiceVersionsPage, VersionItem } from "./types";

const OLENA = "usr-olena"; // heads family law, accountable for the service
const TARAS = "usr-taras"; // release reviewer in family law, cover on the service
const IRYNA = "usr-admin";
const STRANGER = "usr-stranger"; // a lawyer attached to nothing

const page: Pick<ServiceVersionsPage, "signatories" | "assignments"> = {
  signatories: [
    { lawyer: { id: OLENA, fullName: "Olena" }, isHead: true },
    { lawyer: { id: TARAS, fullName: "Taras" }, isHead: false },
  ],
  assignments: [
    { lawyerId: OLENA, isPrimary: true },
    { lawyerId: TARAS, isPrimary: false },
  ],
};

/** Olena alone signs for the area — the founding case. */
const soloPage: typeof page = {
  signatories: [{ lawyer: { id: OLENA, fullName: "Olena" }, isHead: true }],
  assignments: page.assignments,
};

const admin: Viewer = { userId: IRYNA, role: "admin" };
const olena: Viewer = { userId: OLENA, role: "lawyer" };
const taras: Viewer = { userId: TARAS, role: "lawyer" };
const stranger: Viewer = { userId: STRANGER, role: "lawyer" };
const nobody: Viewer = { userId: null, role: null };

function version(overrides: Partial<VersionItem>): VersionItem {
  return {
    id: "sv-1",
    version: 1,
    status: "draft",
    generationMode: "template",
    reviewMode: "auto",
    priceMinor: null,
    currency: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    author: { id: OLENA, fullName: "Olena" },
    release: { kind: "none" },
    sale: null,
    openPause: null,
    pauses: [],
    ...overrides,
  };
}

const kinds = (v: VersionItem, p: typeof page, who: Viewer) =>
  availableActions(v, p, who).map((a) => a.kind);

describe("the author's act", () => {
  it("an assigned lawyer moves a draft to review and back", () => {
    expect(kinds(version({ status: "draft" }), page, olena)).toEqual(["submitForReview"]);
    expect(kinds(version({ status: "in_review" }), page, taras)).toContain("returnToDraft");
  });

  it("a lawyer attached to nothing, and an admin, get neither", () => {
    expect(kinds(version({ status: "draft" }), page, stranger)).toEqual([]);
    expect(kinds(version({ status: "draft" }), page, admin)).toEqual([]);
  });

  it("nobody signed in gets nothing", () => {
    expect(kinds(version({ status: "in_review" }), page, nobody)).toEqual([]);
  });
});

describe("the professional act", () => {
  const inReview = version({ status: "in_review" });

  it("a signatory releases a version in review that they did not write", () => {
    expect(availableActions(inReview, page, taras)).toContainEqual({
      kind: "release",
      self: false,
    });
  });

  it("the author is refused while the area has another signatory", () => {
    expect(kinds(inReview, page, olena)).not.toContain("release");
  });

  it("the author is offered a flagged self-release when nobody else signs", () => {
    expect(availableActions(inReview, soloPage, olena)).toContainEqual({
      kind: "release",
      self: true,
    });
  });

  it("an admin never signs", () => {
    expect(kinds(inReview, page, admin)).not.toContain("release");
  });

  it("a draft, a signed version and a sold one are not offered", () => {
    expect(kinds(version({ status: "draft" }), page, taras)).not.toContain("release");
    expect(
      kinds(
        version({
          status: "in_review",
          release: {
            kind: "signed",
            by: { id: TARAS, fullName: "Taras" },
            at: "x",
            selfReleased: false,
          },
        }),
        page,
        taras,
      ),
    ).not.toContain("release");
    expect(
      kinds(
        version({ status: "published", sale: { by: { id: IRYNA, fullName: "Iryna" }, at: "x" } }),
        page,
        taras,
      ),
    ).not.toContain("release");
  });
});

describe("the commercial act", () => {
  const released = version({
    status: "in_review",
    release: { kind: "signed", by: { id: TARAS, fullName: "Taras" }, at: "x", selfReleased: false },
  });

  it("an admin puts a released version on sale", () => {
    expect(kinds(released, page, admin)).toEqual(["putOnSale"]);
  });

  it("not an unreleased one, and no lawyer ever", () => {
    expect(kinds(version({ status: "in_review" }), page, admin)).toEqual([]);
    expect(kinds(released, page, olena)).not.toContain("putOnSale");
    expect(kinds(released, page, taras)).not.toContain("putOnSale");
  });
});

describe("pausing (§5.7)", () => {
  const live = version({
    status: "published",
    release: { kind: "signed", by: { id: TARAS, fullName: "Taras" }, at: "x", selfReleased: false },
    sale: { by: { id: IRYNA, fullName: "Iryna" }, at: "x" },
  });

  it("an admin opens a pause for any reason, commercial included", () => {
    expect(availableActions(live, page, admin)).toContainEqual({
      kind: "pause",
      reasons: ["law_impact", "defect", "generation", "no_reviewer", "commercial"],
    });
  });

  it("a signatory and the accountable lawyer open professional pauses only", () => {
    const professional = ["law_impact", "defect", "generation", "no_reviewer"];
    expect(availableActions(live, page, taras)).toContainEqual({
      kind: "pause",
      reasons: professional,
    });
    expect(availableActions(live, soloPage, olena)).toContainEqual({
      kind: "pause",
      reasons: professional,
    });
  });

  it("a lawyer who is neither gets no pause button", () => {
    expect(kinds(live, page, stranger)).toEqual([]);
  });

  it("a version already paused, or not on sale, is not offered another", () => {
    const paused = version({
      ...live,
      status: "paused",
      openPause: {
        id: "p-1",
        reason: "defect",
        note: null,
        openedBy: null,
        openedAt: "x",
        outcome: { kind: "open" },
      },
    });
    expect(kinds(paused, page, admin)).not.toContain("pause");
    expect(kinds(version({ status: "in_review" }), page, admin)).not.toContain("pause");
  });
});

describe("lifting a pause (§5.7)", () => {
  const pausedFor = (reason: "defect" | "commercial") =>
    version({
      status: "paused",
      sale: { by: { id: IRYNA, fullName: "Iryna" }, at: "x" },
      openPause: {
        id: "p-1",
        reason,
        note: null,
        openedBy: null,
        openedAt: "x",
        outcome: { kind: "open" },
      },
    });

  it("a professional pause is lifted by a signatory, never by an admin", () => {
    expect(availableActions(pausedFor("defect"), page, taras)).toContainEqual({
      kind: "lift",
      pauseId: "p-1",
    });
    expect(kinds(pausedFor("defect"), page, admin)).not.toContain("lift");
  });

  it("a commercial pause is lifted by an admin, never by a lawyer", () => {
    expect(availableActions(pausedFor("commercial"), page, admin)).toContainEqual({
      kind: "lift",
      pauseId: "p-1",
    });
    expect(kinds(pausedFor("commercial"), page, olena)).not.toContain("lift");
  });

  it("the accountable lawyer who does not sign cannot lift", () => {
    const notSigning: typeof page = { signatories: [], assignments: page.assignments };
    expect(kinds(pausedFor("defect"), notSigning, olena)).not.toContain("lift");
  });
});
