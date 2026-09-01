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

const { listForService, addReference, removeReference, previewArticle, observeArticle } =
  vi.hoisted(() => ({
    listForService: vi.fn<() => Promise<ServiceLawPageData>>(),
    addReference: vi.fn(),
    removeReference: vi.fn(),
    previewArticle: vi.fn(),
    observeArticle: vi.fn(),
  }));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();

  return {
    ...actual,
    lawApi: {
      listForService,
      addReference,
      removeReference,
      previewArticle,
      observeArticle,
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
  previewArticle.mockReset();
  observeArticle.mockReset();
});

/** A reading of article 105, as the fetcher would have returned it. */
const READING = {
  actId: "2947-14",
  article: "105",
  text: "Стаття 105. Припинення шлюбу внаслідок розірвання шлюбу",
  fingerprint: `sha256:${"c".repeat(64)}`,
  normalizerVersion: 1,
  publishedRevisionDate: "2026-08-05",
  fetchedAt: "2026-09-01T10:00:00.000Z",
};

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
    previewArticle.mockResolvedValue({ ok: true, reading: READING });
    observeArticle.mockResolvedValue({
      ok: true,
      reading: READING,
      outcome: "first",
      state: "verified",
      confirmed: true,
    });
  });

  async function fillLink(url: string) {
    await screen.findByText(text("serviceLaw.add.title"));
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.url")), { target: { value: url } });
  }

  function fillArticle(value: string) {
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.article")), {
      target: { value },
    });
  }

  /** The step ADM-42 added: read the article back, and wait for it to arrive. */
  async function readItBack() {
    fireEvent.click(screen.getByText(text("serviceLaw.check.button")));
    await screen.findByText(text("serviceLaw.check.title"));
  }

  /** Everything but the link and the article, which each test supplies. */
  function fillRest() {
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.actTitle")), {
      target: { value: "Сімейний кодекс України" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceLaw.add.reliedOn")), {
      target: { value: "Grounds for dissolution." },
    });
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

  // §9.4: an act-level dependency has no one article to read back, and the
  // screen says which of the two kinds of entry this is before the button.
  it("offers the check for an article and explains its absence for a whole act", async () => {
    renderPage();
    await screen.findByText(text("serviceLaw.add.title"));

    expect(screen.getByText(text("serviceLaw.check.button"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.add.actNotFetched"))).toBeNull();

    fireEvent.click(screen.getByLabelText(text("serviceLaw.add.wholeAct")));

    expect(screen.getByText(text("serviceLaw.add.actNotFetched"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.check.button"))).toBeNull();
  });

  it("shows the article text the source returned, with its revision date", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    await readItBack();

    expect(previewArticle).toHaveBeenCalledWith({
      url: "https://zakon.rada.gov.ua/laws/show/2947-14",
      article: "105",
    });
    expect(screen.getByText(/Припинення шлюбу/)).toBeDefined();
    expect(
      screen.getByText(
        translate(DEFAULT_LOCALE, "serviceLaw.check.redaction", { date: "2026-08-05" }),
      ),
    ).toBeDefined();
  });

  // The mistake the form cannot see for itself: right link, right shape, wrong
  // article. It reads as its own sentence and not as a broken request.
  it("names a wrong article number as such, not as a failure to reach the source", async () => {
    previewArticle.mockResolvedValue({ ok: false, failure: { reason: "heading_mismatch" } });
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("900");
    fireEvent.click(screen.getByText(text("serviceLaw.check.button")));

    expect(
      await screen.findByText(text("serviceLaw.check.failure.heading_mismatch")),
    ).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.check.failure.transport"))).toBeNull();
    expect(screen.queryByText(text("serviceLaw.check.error"))).toBeNull();
  });

  it("tells a source that did not answer from an article that is not there", async () => {
    previewArticle.mockResolvedValue({ ok: false, failure: { reason: "transport" } });
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fireEvent.click(screen.getByText(text("serviceLaw.check.button")));

    expect(await screen.findByText(text("serviceLaw.check.failure.transport"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.check.failure.heading_mismatch"))).toBeNull();
  });

  // The register has no delete path, so a norm entered by mistake is watched
  // forever. This is the gate that keeps one from being entered.
  it("will not save an article nobody has read back", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fillRest();

    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));
    expect(addReference).not.toHaveBeenCalled();

    await readItBack();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));
    expect(addReference).toHaveBeenCalled();
  });

  it("stops trusting a reading once the article number is edited under it", async () => {
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fillRest();
    await readItBack();

    // Checked 105, then typed 106. The text on screen is no longer about the
    // article being saved, so the confirmation cannot carry over.
    fillArticle("106");

    expect(screen.getByText(text("serviceLaw.check.stale"))).toBeDefined();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));
    expect(addReference).not.toHaveBeenCalled();
  });

  it("confirms the saved norm against the text the lawyer actually read", async () => {
    addReference.mockResolvedValue(ref());
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fillRest();
    await readItBack();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(await screen.findByText(text("serviceLaw.check.confirmed"))).toBeDefined();
    expect(observeArticle).toHaveBeenCalledWith({
      normId: "norm-1",
      confirmedFingerprint: READING.fingerprint,
    });
  });

  // §9.10: a save that could not be confirmed must not read like one that was.
  it("says when the article moved between the check and the save", async () => {
    addReference.mockResolvedValue(ref());
    observeArticle.mockResolvedValue({
      ok: true,
      reading: READING,
      outcome: "first",
      state: "unverified",
      confirmed: false,
    });
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fillRest();
    await readItBack();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(await screen.findByText(text("serviceLaw.check.moved"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.check.confirmed"))).toBeNull();
  });

  it("says when the norm was saved and the second look failed", async () => {
    addReference.mockResolvedValue(ref());
    observeArticle.mockResolvedValue({
      ok: false,
      failure: { reason: "transport" },
      state: "unreachable",
    });
    renderPage();
    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14");
    fillArticle("105");
    fillRest();
    await readItBack();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(await screen.findByText(text("serviceLaw.check.unreachable"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.check.confirmed"))).toBeNull();
  });

  it("submits a complete entry and clears the form", async () => {
    addReference.mockResolvedValue(ref());
    renderPage();

    await fillLink("https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101");
    fillArticle("ст. 105");
    fillRest();
    await readItBack();
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
    fillArticle("105");
    fillRest();
    await readItBack();
    fireEvent.click(screen.getByText(text("serviceLaw.add.submit")));

    expect(await screen.findByText(text("serviceLaw.add.error.conflict"))).toBeDefined();
    expect(screen.queryByText(text("serviceLaw.error.load"))).toBeNull();
  });
});
