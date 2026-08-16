// The §4 states of the register, asserted by which dictionary key each branch
// picks (DoD §8).
//
// Every branch here returns an `EmptyState` or a paragraph, every one compiles,
// and the only difference between them is the sentence a lawyer reads when the
// screen is blank. On this screen that difference is unusually costly: "the
// register holds no norms" after a failed request tells a reader that no
// legislation is being monitored at all.
//
// The seam is `../api`, the feature's own contract — the boundary ADR-0012 put
// there. A test reaching past it into Supabase would be testing the network.

import {
  DEFAULT_LOCALE,
  I18nProvider,
  INTL_LOCALES,
  translate,
  translatePlural,
  type TranslationKey,
} from "@legal-ai/i18n";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import { formatDate } from "../../../shared/format";
import type { LawNormListItem } from "../api";
import { LawRegisterPage } from "./LawRegisterPage";

const { listNorms, setCadence } = vi.hoisted(() => ({
  listNorms: vi.fn<() => Promise<LawNormListItem[]>>(),
  setCadence: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  // `freshnessOf` and the types come from the real module: this test replaces
  // the data access and not the rules, and a stubbed derivation would make the
  // freshness assertions below prove nothing.
  const actual = await importOriginal<typeof import("../api")>();

  return {
    ...actual,
    lawApi: {
      listNorms,
      setCadence,
      listForService: () => {
        throw new Error("listForService is not part of the register screen");
      },
      addReference: () => {
        throw new Error("addReference is not part of the register screen");
      },
      removeReference: () => {
        throw new Error("removeReference is not part of the register screen");
      },
    },
  };
});

/** The dictionary is the source of the expected text: a reworded sentence is not a regression. */
function text(key: TranslationKey): string {
  return translate(DEFAULT_LOCALE, key);
}

function norm(overrides: Partial<LawNormListItem> = {}): LawNormListItem {
  return {
    id: "norm-1",
    source: "zakon_rada",
    actId: "2947-14",
    actTitle: "Сімейний кодекс України",
    scope: "article",
    article: "105",
    actScopeReason: null,
    sourceUrl: "https://zakon.rada.gov.ua/laws/show/2947-14",
    canonicalUrl: "https://zakon.rada.gov.ua/laws/show/2947-14",
    state: "verified",
    freshness: { kind: "fresh", verifiedAt: "2026-08-15T04:00:00.000Z" },
    probeIntervalHours: 24,
    intervalReason: null,
    lastCheckedAt: "2026-08-15T04:00:00.000Z",
    lastVerifiedAt: "2026-08-15T04:00:00.000Z",
    dependents: [{ serviceId: "svc-divorce", serviceTitle: "Divorce application" }],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <LawRegisterPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  listNorms.mockReset();
  setCadence.mockReset();
});

describe("LawRegisterPage", () => {
  it("shows a loading state rather than an empty table", async () => {
    listNorms.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByText(text("law.loading"))).toBeDefined();
  });

  it("says the register is empty when it genuinely is", async () => {
    listNorms.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(text("law.empty.title"))).toBeDefined();
    expect(screen.queryByText(text("law.failed.title"))).toBeNull();
  });

  // The single most repeatable mistake on a screen like this (DoD §4), and the
  // costliest one here: an empty register and a broken request must not share a
  // rendering.
  it("does not call a failed load an empty register", async () => {
    listNorms.mockRejectedValue(new AppError("unknown", "boom"));
    renderPage();

    expect(await screen.findByText(text("law.failed.title"))).toBeDefined();
    expect(screen.getByText(text("law.error.load"))).toBeDefined();
    expect(screen.queryByText(text("law.empty.title"))).toBeNull();
  });

  it("tells a reader without the rights apart from a request that broke", async () => {
    listNorms.mockRejectedValue(new AppError("forbidden", "nope"));
    renderPage();

    expect(await screen.findByText(text("law.error.forbidden"))).toBeDefined();
    expect(screen.queryByText(text("law.error.load"))).toBeNull();
  });

  it("renders the state and the freshness as two separate claims", async () => {
    // A norm whose last check found no difference, and which nobody has checked
    // since. One badge would paint this green.
    listNorms.mockResolvedValue([
      norm({
        state: "verified",
        freshness: { kind: "stale", verifiedAt: "2026-07-01T04:00:00.000Z" },
      }),
    ]);
    renderPage();

    expect(await screen.findByText(text("law.state.verified"))).toBeDefined();
    // Asserted through the key rather than against the Ukrainian sentence: the
    // claim is which branch was picked, and a reworded dictionary is not a
    // regression (DoD §8).
    const when = formatDate("2026-07-01T04:00:00.000Z", INTL_LOCALES[DEFAULT_LOCALE]);
    expect(
      screen.getByText(translate(DEFAULT_LOCALE, "law.freshness.stale", { when })),
    ).toBeDefined();
  });

  it("says a norm has never been checked rather than showing a blank date", async () => {
    listNorms.mockResolvedValue([
      norm({ state: "unverified", freshness: { kind: "never_checked" }, lastVerifiedAt: null }),
    ]);
    renderPage();

    expect(await screen.findByText(text("law.freshness.never"))).toBeDefined();
  });

  // §9.3, on screen: one row, and every service resting on it beside it.
  it("lists every dependent service against the one norm", async () => {
    listNorms.mockResolvedValue([
      norm({
        dependents: [
          { serviceId: "svc-divorce", serviceTitle: "Divorce application" },
          { serviceId: "svc-alimony", serviceTitle: "Alimony claim" },
        ],
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Divorce application")).toBeDefined();
    expect(screen.getByText("Alimony claim")).toBeDefined();
    expect(screen.getByText(translatePlural(DEFAULT_LOCALE, "law.dependents", 2))).toBeDefined();
  });

  it("marks an act-level norm as the exception it is, not as a missing article", async () => {
    listNorms.mockResolvedValue([
      norm({ scope: "act", article: null, actScopeReason: "Whole act; noise expected." }),
    ]);
    renderPage();

    expect(await screen.findByText(text("law.wholeAct"))).toBeDefined();
  });

  it("says a norm nothing depends on rather than leaving the cell blank", async () => {
    listNorms.mockResolvedValue([norm({ dependents: [] })]);
    renderPage();

    expect(await screen.findByText(text("law.dependents.none"))).toBeDefined();
  });

  it("renders a weekly cadence in days rather than in hours", async () => {
    listNorms.mockResolvedValue([norm({ probeIntervalHours: 168 })]);
    renderPage();

    expect(
      await screen.findByText(translatePlural(DEFAULT_LOCALE, "law.cadence.everyDays", 7)),
    ).toBeDefined();
  });
});
