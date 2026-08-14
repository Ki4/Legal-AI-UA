// The first component test in this repository, and it exists for a specific
// gap: `pnpm check:copy` decides whether a screen's copy *could* be right, and
// `pnpm typecheck` decides whether it compiles, but until now nothing at all
// decided whether a screen renders. Every rendering claim in the sessions
// before this one rests on somebody reading the code or clicking a live page.
//
// What it holds the catalogue to is §4.1's rule that "nothing exists", "nothing
// matches your filter" and "the request failed" are three screens rather than
// one. That is the kind of claim a type cannot make: all three branches return
// `EmptyState`, all three compile, and the only difference is which sentence a
// lawyer reads when the screen is blank.
//
// The seam is `../api`, the feature's own contract — the same one ADR-0012 put
// there so the screen could be moved from fixtures to Postgres without a
// component changing. A test mocking it is using the boundary for what it is
// for; a test reaching past it into Supabase would be testing the network.

import {
  DEFAULT_LOCALE,
  I18nProvider,
  translate,
  translatePlural,
  type TranslationKey,
} from "@legal-ai/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { CatalogueView, ServiceListItem } from "../api";
import { ServicesListPage } from "./ServicesListPage";

// `vi.hoisted`, not a plain `const`: the factory below is hoisted above this
// file's own statements and runs while `ServicesListPage`'s import graph is
// being evaluated, which is before any `const` here has been initialised.
const { browse } = vi.hoisted(() => ({
  browse: vi.fn<() => Promise<CatalogueView>>(),
}));

vi.mock("../api", () => ({
  servicesApi: {
    browse,
    // This screen never calls it. A stub that throws says so out loud instead
    // of returning undefined and failing somewhere further along.
    get: () => {
      throw new Error("services.get is not part of the catalogue screen");
    },
  },
}));

// The dictionary is the source of the expected text, deliberately: asserting on
// the Ukrainian sentence itself would turn every rewording into a red test
// while still not proving the screen picked the right key. The claim under test
// is which key each state renders.
const t = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

const FAMILY = {
  code: "family",
  labels: { uk: "Сімейне право", en: "Family law" },
  position: 1,
};

const IT = { code: "it", labels: { uk: "ІТ", en: "IT" }, position: 2 };

function view(overrides: Partial<CatalogueView> = {}): CatalogueView {
  return { items: [], areas: [], statuses: [], matchedBeforeFacets: 0, ...overrides };
}

function service(overrides: Partial<ServiceListItem> = {}): ServiceListItem {
  return {
    id: "svc-1",
    slug: "divorce-claim",
    title: "Позов про розірвання шлюбу",
    summary: null,
    practiceArea: FAMILY,
    primaryLawyer: null,
    coverLawyers: [],
    currentVersion: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

// The URL is an argument because the catalogue's filter state lives there
// rather than in the hook (§4.1) — "the reader has narrowed to an area" is set
// up by rendering at a different address, exactly as a pasted link would.
function renderCatalogue(url = "/services") {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <ServicesListPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("ServicesListPage", () => {
  beforeEach(() => {
    browse.mockReset();
  });

  it("announces the wait rather than showing an empty catalogue", () => {
    // Never resolves: the loading state is the whole subject, and a promise
    // that settles would make this a race against the assertion.
    browse.mockReturnValue(new Promise(() => {}));

    renderCatalogue();

    // Spinner is aria-hidden by design, so the wrapper carries the
    // announcement. Reading it through the role is what checks that.
    expect(screen.getByRole("status").textContent).toContain(t("catalogue.loading"));
    expect(screen.queryByText(t("catalogue.empty.none.title"))).toBeNull();
  });

  it("renders what arrived", async () => {
    browse.mockResolvedValue(
      view({ items: [service()], areas: [{ area: FAMILY, count: 1 }], matchedBeforeFacets: 1 }),
    );

    renderCatalogue();

    expect(await screen.findByRole("link", { name: "Позов про розірвання шлюбу" })).toBeInstanceOf(
      HTMLAnchorElement,
    );
    // Grouped, because no area is chosen. The heading carries its count.
    expect(screen.getByRole("heading", { level: 2, name: /Сімейне право/ })).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says the catalogue is empty when nothing exists at all", async () => {
    browse.mockResolvedValue(view());

    renderCatalogue();

    expect(await screen.findByText(t("catalogue.empty.none.title"))).toBeDefined();
    expect(screen.getByText(t("catalogue.empty.none.hint"))).toBeDefined();
    // The three states are only distinguishable by which one is absent.
    expect(screen.queryByText(t("catalogue.empty.search.title"))).toBeNull();
    expect(screen.queryByText(t("catalogue.failed.title"))).toBeNull();
  });

  it("says the search found nothing, not that the firm has no services", async () => {
    // Nothing matched, and nothing was matched before the facets either — so
    // this is a search that found nothing rather than filters that excluded
    // everything.
    browse.mockResolvedValue(view());

    renderCatalogue("/services?q=zzz");

    expect(await screen.findByText(t("catalogue.empty.search.title"))).toBeDefined();
    expect(screen.queryByText(t("catalogue.empty.none.title"))).toBeNull();
  });

  it("counts what the chosen area is hiding instead of implying it does not exist", async () => {
    // Two services match the search; the reader is looking at an area holding
    // none of them. Rendered as a plain empty result this says the firm has no
    // such service, and the next thing a lawyer does is build a second copy of
    // one that already exists.
    browse.mockResolvedValue(view({ areas: [{ area: IT, count: 2 }], matchedBeforeFacets: 2 }));

    renderCatalogue("/services?area=family");

    expect(await screen.findByText(t("catalogue.empty.filters.title"))).toBeDefined();
    expect(
      screen.getByText(
        `${t("catalogue.empty.filters.elsewhere")} ${translatePlural(
          DEFAULT_LOCALE,
          "catalogue.matchesElsewhere",
          2,
        )}`,
      ),
    ).toBeDefined();
    expect(screen.queryByText(t("catalogue.empty.none.title"))).toBeNull();
  });

  it("distinguishes a failed request from an empty catalogue", async () => {
    browse.mockRejectedValue(new AppError("network", "getaddrinfo ENOTFOUND db.example"));

    renderCatalogue();

    // The code's sentence, in the reader's language.
    expect(await screen.findByText(t("catalogue.error.network"))).toBeDefined();
    expect(screen.getByText(t("catalogue.failed.title"))).toBeDefined();
    // Telling an admin to create their first service when the fetch broke is
    // worse than saying nothing.
    expect(screen.queryByText(t("catalogue.empty.none.title"))).toBeNull();
    // `AppError.message` is developer text and always English. The rule is that
    // it never reaches a lawyer; this is the rule as an assertion.
    expect(screen.queryByText(/ENOTFOUND/)).toBeNull();
  });

  it("retries when asked, because the sentence promises something to try", async () => {
    browse.mockRejectedValueOnce(new AppError("network", "no route to host"));
    browse.mockResolvedValue(
      view({ items: [service()], areas: [{ area: FAMILY, count: 1 }], matchedBeforeFacets: 1 }),
    );

    renderCatalogue();

    fireEvent.click(await screen.findByRole("button", { name: t("common.tryAgain") }));

    expect(await screen.findByRole("link", { name: "Позов про розірвання шлюбу" })).toBeDefined();
    expect(screen.queryByText(t("catalogue.error.network"))).toBeNull();
    expect(browse).toHaveBeenCalledTimes(2);
  });
});
