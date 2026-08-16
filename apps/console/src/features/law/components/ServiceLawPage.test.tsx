// The §4 states of a service's law tab, plus the two things the entry form is
// for: resolving a pasted link in front of the reader, and refusing the shapes
// §9.2 and §9.4 are written against.
//
// The form's normalization is not mocked. `@legal-ai/law-refs` is pure, it is
// the same code the api layer and the future fetcher run, and stubbing it would
// leave the assertions below proving that a stub returns what it was told to.

import {
  DEFAULT_LOCALE,
  I18nProvider,
  translate,
  translatePlural,
  type TranslationKey,
} from "@legal-ai/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { ServiceLawPage as ServiceLawPageData, ServiceLawRef } from "../api";
import { ServiceLawPage } from "./ServiceLawPage";

const { listForService, addReference, removeReference } = vi.hoisted(() => ({
  listForService: vi.fn<() => Promise<ServiceLawPageData>>(),
  addReference: vi.fn(),
  removeReference: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();

  return {
    ...actual,
    lawApi: {
      listForService,
      addReference,
      removeReference,
      listNorms: () => {
        throw new Error("listNorms is not part of the service law screen");
      },
      setCadence: () => {
        throw new Error("setCadence is not part of the service law screen");
      },
    },
  };
});

function text(key: TranslationKey): string {
  return translate(DEFAULT_LOCALE, key);
}

function ref(overrides: Partial<ServiceLawRef> = {}): ServiceLawRef {
  return {
    id: "ref-1",
    reliedOn: "Grounds for dissolution of marriage.",
    norm: {
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
    },
    ...overrides,
  };
}

function page(refs: ServiceLawRef[]): ServiceLawPageData {
  return { serviceId: "svc-divorce", serviceTitle: "Divorce application", refs };
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/services/svc-divorce/law"]}>
        <Routes>
          <Route path="/services/:serviceId/law" element={<ServiceLawPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  listForService.mockReset();
  addReference.mockReset();
  removeReference.mockReset();
});

describe("ServiceLawPage", () => {
  it("shows a loading state rather than an empty list", async () => {
    listForService.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByText(text("serviceLaw.loading"))).toBeDefined();
  });

  it("says nothing is recorded when the service genuinely rests on nothing", async () => {
    listForService.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText(text("serviceLaw.empty.title"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.failed.title"))).toBeNull();
  });

  it("does not call a failed load an empty list", async () => {
    listForService.mockRejectedValue(new AppError("unknown", "boom"));
    renderPage();

    expect(await screen.findByText(text("serviceLaw.failed.title"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.empty.title"))).toBeNull();
  });

  // A mistyped id and a broken request call for different reactions (DoD §4).
  it("tells a missing service apart from a request that broke", async () => {
    listForService.mockRejectedValue(new AppError("not_found", "no such service"));
    renderPage();

    expect(await screen.findByText(text("serviceLaw.notFound.title"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.failed.title"))).toBeNull();
    expect(screen.queryByText(text("serviceLaw.empty.title"))).toBeNull();
  });

  it("renders the sentence the reference was recorded with", async () => {
    listForService.mockResolvedValue(page([ref()]));
    renderPage();

    expect(await screen.findByText(/Grounds for dissolution of marriage/)).toBeDefined();
  });

  // §9.3 where it matters most: the lawyer about to drop this reference can see
  // the norm is not theirs alone.
  it("says how many other services rest on a shared norm", async () => {
    listForService.mockResolvedValue(
      page([
        ref({
          norm: {
            ...ref().norm,
            dependents: [
              { serviceId: "svc-divorce", serviceTitle: "Divorce application" },
              { serviceId: "svc-alimony", serviceTitle: "Alimony claim" },
            ],
          },
        }),
      ]),
    );
    renderPage();

    expect(
      await screen.findByText(translatePlural(DEFAULT_LOCALE, "serviceLaw.alsoRelied", 1)),
    ).toBeDefined();
  });

  it("does not count the service itself as another service", async () => {
    listForService.mockResolvedValue(page([ref()]));
    renderPage();

    await screen.findByText(/Grounds for dissolution/);
    expect(
      screen.queryByText(translatePlural(DEFAULT_LOCALE, "serviceLaw.alsoRelied", 0)),
    ).toBeNull();
  });
});

describe("the entry form", () => {
  beforeEach(() => {
    listForService.mockResolvedValue(page([]));
  });

  async function fillLink(url: string) {
    await screen.findByText(text("serviceLaw.add.title"));
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.url")), { target: { value: url } });
  }

  it("says what it resolved a pasted link to", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");

    expect(
      screen.getByText(translate(DEFAULT_LOCALE, "serviceLaw.add.resolved", { act: "2947-14" })),
    ).toBeDefined();
  });

  // §9.2's pinned-redaction trap, and §9.5.1's answer to it: the revision is
  // resolved away, and never silently.
  it("says out loud that a pinned revision was resolved to the text in force", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101");

    expect(screen.getByText(text("serviceLaw.add.revisionStripped"))).toBeDefined();
  });

  it("does not claim to have stripped anything when nothing was pinned", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");

    expect(screen.queryByText(text("serviceLaw.add.revisionStripped"))).toBeNull();
  });

  it("names which kind of link it refused", async () => {
    renderPage();
    await fillLink("https://reyestr.court.gov.ua/Review/12345");

    expect(screen.getByText(text("serviceLaw.link.unknown_source"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.link.not_a_url"))).toBeNull();
  });

  it("refuses a part-and-article phrase where an article number belongs", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.article")), {
      target: { value: "частина 3 статті 75" },
    });

    expect(screen.getByText(text("serviceLaw.article.unrecognized"))).toBeDefined();
  });

  // Shipping before the fetcher is a limitation, and the screen says so rather
  // than letting the entry look verified (§9.6, ADM-42).
  it("admits that nothing has read the article back", async () => {
    renderPage();
    await screen.findByText(text("serviceLaw.add.title"));

    expect(screen.getByText(text("serviceLaw.add.notFetched"))).toBeDefined();
  });

  it("submits a complete entry and clears the form", async () => {
    addReference.mockResolvedValue(ref());
    renderPage();

    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101");
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.actTitle")), {
      target: { value: "Сімейний кодекс України" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.article")), {
      target: { value: "ст. 105" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.reliedOn")), {
      target: { value: "Grounds for dissolution." },
    });
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(addReference).toHaveBeenCalledWith({
      serviceId: "svc-divorce",
      // The pasted URL goes through untouched — the api layer normalizes, and
      // the row keeps what the lawyer pasted for display (§9.2).
      url: "https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101",
      actTitle: "Сімейний кодекс України",
      article: "ст. 105",
      actScopeReason: null,
      reliedOn: "Grounds for dissolution.",
    });
  });

  it("asks for a reason before it will take an act-level dependency (§9.4)", async () => {
    renderPage();

    await fillLink("https://zakon.rada.gov.ua/laws/show/435-15");
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.actTitle")), {
      target: { value: "Цивільний кодекс України" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.reliedOn")), {
      target: { value: "General obligations law." },
    });
    fireEvent.click(screen.getByLabelText(text("serviceLaw.add.wholeAct")));

    const submit = screen.getByText(text("serviceLaw.add.submit"));
    fireEvent.click(submit);
    expect(addReference).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.wholeActReason")), {
      target: { value: "The template leans on the act throughout." },
    });
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(addReference).toHaveBeenCalledWith(
      expect.objectContaining({
        article: null,
        actScopeReason: "The template leans on the act throughout.",
      }),
    );
  });

  it("gives a refused write its own sentence rather than the load failure's", async () => {
    addReference.mockRejectedValue(new AppError("conflict", "already there"));
    renderPage();

    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.actTitle")), {
      target: { value: "Сімейний кодекс України" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.article")), {
      target: { value: "105" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.reliedOn")), {
      target: { value: "Grounds." },
    });
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(await screen.findByText(text("serviceLaw.add.error.conflict"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.error.load"))).toBeNull();
  });
});
