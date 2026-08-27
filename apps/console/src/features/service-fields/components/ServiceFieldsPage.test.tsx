// The §4 states of the field dictionary, plus the half of ADM-19 that no type
// can decide: which sentence a lawyer reads when a GDPR half is missing.
//
// Four of the branches below render an `EmptyState` or a paragraph and all four
// compile. What separates "this questionnaire asks nothing" from "no such
// service" from "the request broke" is only which key the branch picked — and on
// this screen the first is the *expected* answer for most services today, which
// is what makes the mix-up likely rather than hypothetical.
//
// The seam is `../api`, the feature's own contract. `validateDraft` is not
// mocked: it is pure, it is the same function the fixture and the screen both
// run, and stubbing it would leave the refusal assertions proving that a stub
// returns what it was told to.

import { DEFAULT_LOCALE, I18nProvider, translate, type TranslationKey } from "@legal-ai/i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { QuestionnaireFieldItem, ServiceFieldsPage as PageData } from "../api";
import { ServiceFieldsPage } from "./ServiceFieldsPage";

const { listForService, create, update, remove, move } = vi.hoisted(() => ({
  listForService: vi.fn<() => Promise<PageData>>(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();

  return {
    ...actual,
    serviceFieldsApi: { listForService, create, update, remove, move },
  };
});

function text(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(DEFAULT_LOCALE, key, params);
}

function field(overrides: Partial<QuestionnaireFieldItem> = {}): QuestionnaireFieldItem {
  return {
    id: "qf-1",
    serviceId: "svc-divorce",
    key: "applicant_name",
    label: "Applicant's full name",
    helpText: null,
    type: "text",
    required: true,
    position: 0,
    options: null,
    personalData: { kind: "none" },
    createdAt: "2026-05-12T09:25:00.000Z",
    updatedAt: "2026-05-12T09:25:00.000Z",
    ...overrides,
  };
}

function page(fields: QuestionnaireFieldItem[]): PageData {
  return { serviceId: "svc-divorce", serviceTitle: "Divorce application", fields };
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/services/svc-divorce/fields"]}>
        <Routes>
          <Route path="/services/:serviceId/fields" element={<ServiceFieldsPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listForService.mockResolvedValue(page([field()]));
});

describe("screen states", () => {
  it("announces the load rather than showing an empty table", async () => {
    listForService.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getByRole("status")).toHaveProperty("textContent", text("serviceFields.loading"));
  });

  it("renders what arrived", async () => {
    renderPage();

    expect(await screen.findByText("Applicant's full name")).toBeTruthy();
    expect(screen.getByText("applicant_name")).toBeTruthy();
  });

  it("says the questionnaire is empty when it is", async () => {
    listForService.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText(text("serviceFields.empty.title"))).toBeTruthy();
  });

  it("does not say the questionnaire is empty when the request broke", async () => {
    // The most repeatable mistake on a list screen (DoD §4): the failed load
    // and the genuinely empty dictionary must not share a rendering. Both
    // assertions matter — the second is the one that catches a regression.
    listForService.mockRejectedValue(new AppError("unknown", "boom"));
    renderPage();

    expect(await screen.findByText(text("serviceFields.failed.title"))).toBeTruthy();
    expect(screen.queryByText(text("serviceFields.empty.title"))).toBeNull();
    expect(screen.getByText(text("serviceFields.error.load"))).toBeTruthy();
  });

  it("distinguishes a reader with no rights from a request that never completed", async () => {
    listForService.mockRejectedValue(new AppError("forbidden", "nope"));
    renderPage();
    expect(await screen.findByText(text("serviceFields.error.forbidden"))).toBeTruthy();

    listForService.mockRejectedValue(new AppError("network", "nope"));
    fireEvent.click(screen.getByRole("button", { name: text("common.tryAgain") }));
    expect(await screen.findByText(text("serviceFields.error.network"))).toBeTruthy();
  });

  it("tells a mistyped id apart from a broken request, and offers no retry for it", async () => {
    listForService.mockRejectedValue(new AppError("not_found", "nope"));
    renderPage();

    expect(await screen.findByText(text("serviceFields.notFound.title"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: text("common.tryAgain") })).toBeNull();
  });
});

describe("the GDPR half — ADM-19", () => {
  it("shows the basis and the retention of a field that carries personal data", async () => {
    listForService.mockResolvedValue(
      page([field({ personalData: { kind: "personal", basis: "contract", retentionDays: 1095 } })]),
    );
    renderPage();

    expect(await screen.findByText(text("serviceFields.personalData"))).toBeTruthy();
    expect(screen.getByText(text("gdpr.basis.contract"))).toBeTruthy();
    expect(screen.queryByText(text("serviceFields.specialCategory"))).toBeNull();
  });

  it("shows an Art. 9 field as both, because one is a subset of the other", async () => {
    listForService.mockResolvedValue(
      page([
        field({
          personalData: {
            kind: "special",
            basis: "legitimate_interests",
            retentionDays: 1095,
            specialBasis: "legal_claims",
          },
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText(text("serviceFields.personalData"))).toBeTruthy();
    expect(screen.getByText(text("serviceFields.specialCategory"))).toBeTruthy();
  });

  it("reveals the basis and retention only once the field is marked as personal data", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.add") }));

    expect(screen.queryByRole("group", { name: text("serviceFields.editor.basis") })).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", { name: text("serviceFields.editor.personalData") }),
    );

    expect(screen.getByRole("group", { name: text("serviceFields.editor.basis") })).toBeTruthy();
    expect(screen.getByLabelText(text("serviceFields.editor.retention"))).toBeTruthy();
  });

  it("refuses to save personal data with no basis, and says which half is missing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.add") }));

    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.key")), {
      target: { value: "health_note" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.label")), {
      target: { value: "Health note" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: text("serviceFields.editor.personalData") }),
    );
    fireEvent.click(screen.getByRole("button", { name: text("serviceFields.editor.save") }));

    // Nothing was sent, and the reader is told about both blanks at once rather
    // than one per attempt.
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText(text("serviceFields.reject.missing_basis"))).toBeTruthy();
    expect(screen.getByText(text("serviceFields.reject.missing_retention"))).toBeTruthy();
  });

  it("saves once both halves are there, and sends the triad as one thing", async () => {
    create.mockResolvedValue(field({ id: "qf-2", key: "health_note" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.add") }));

    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.key")), {
      target: { value: "health_note" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.label")), {
      target: { value: "Health note" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: text("serviceFields.editor.personalData") }),
    );
    fireEvent.click(screen.getByRole("radio", { name: text("gdpr.basis.contract") }));
    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.retention")), {
      target: { value: "1095" },
    });
    fireEvent.click(screen.getByRole("button", { name: text("serviceFields.editor.save") }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      serviceId: "svc-divorce",
      key: "health_note",
      personalData: { kind: "personal", basis: "contract", retentionDays: 1095 },
    });
  });

  it("reopens a saved personal-data field with its basis and retention filled in", async () => {
    listForService.mockResolvedValue(
      page([field({ personalData: { kind: "personal", basis: "consent", retentionDays: 30 } })]),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.edit") }));

    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: text("gdpr.basis.consent") }).checked,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>(text("serviceFields.editor.retention")).value,
    ).toBe("30");
  });

  it("locks the key when editing, because a rename would break a frozen template", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.edit") }));

    const key = screen.getByLabelText<HTMLInputElement>(text("serviceFields.editor.key"));
    expect(key.disabled).toBe(true);
    expect(screen.getByText(text("serviceFields.editor.keyImmutable"))).toBeTruthy();
  });

  it("refuses a key another field already holds", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.add") }));

    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.key")), {
      target: { value: "applicant_name" },
    });
    fireEvent.change(screen.getByLabelText(text("serviceFields.editor.label")), {
      target: { value: "Another one" },
    });
    fireEvent.click(screen.getByRole("button", { name: text("serviceFields.editor.save") }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText(text("serviceFields.reject.key_taken"))).toBeTruthy();
  });
});

describe("deleting and reordering", () => {
  it("asks before deleting, and does nothing if the question is declined", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.delete") }));

    expect(
      screen.getByRole("heading", {
        name: text("serviceFields.delete.title", { label: "Applicant's full name" }),
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: text("serviceFields.delete.cancel") }));

    await waitFor(() => expect(remove).not.toHaveBeenCalled());
  });

  it("deletes once the question is answered", async () => {
    remove.mockResolvedValue("qf-1");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: text("serviceFields.delete") }));
    fireEvent.click(screen.getByRole("button", { name: text("serviceFields.delete.confirm") }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("qf-1"));
  });

  it("offers no move at the ends of the list", async () => {
    listForService.mockResolvedValue(page([field(), field({ id: "qf-2", key: "marriage_date" })]));
    renderPage();

    const up = await screen.findAllByRole<HTMLButtonElement>("button", {
      name: text("serviceFields.moveUp"),
    });
    const down = screen.getAllByRole<HTMLButtonElement>("button", {
      name: text("serviceFields.moveDown"),
    });

    expect(up[0]?.disabled).toBe(true);
    expect(up[1]?.disabled).toBe(false);
    expect(down[0]?.disabled).toBe(false);
    expect(down[1]?.disabled).toBe(true);
  });

  it("tells a failed reorder apart from a failed save", async () => {
    // Two different actions, two different sentences (DoD §6). A reorder that
    // broke must not tell the reader a field was not saved: they did not try to
    // save a field.
    listForService.mockResolvedValue(page([field(), field({ id: "qf-2", key: "marriage_date" })]));
    move.mockRejectedValue(new AppError("unknown", "boom"));
    renderPage();

    const down = await screen.findAllByRole("button", { name: text("serviceFields.moveDown") });
    fireEvent.click(down[0]!);

    expect(await screen.findByText(text("serviceFields.move.error"))).toBeTruthy();
    expect(screen.queryByText(text("serviceFields.save.error.save"))).toBeNull();
  });
});
