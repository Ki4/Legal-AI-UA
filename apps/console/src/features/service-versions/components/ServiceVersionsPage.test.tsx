// The §4 states of the versions screen, and the half of ADR-0027 no type can
// decide: which button each person sees, and what a refusal says.
//
// Two seams: `../api` — the feature's own contract, with `availableActions`
// left real, since it is pure and stubbing it would make the role assertions
// prove that a stub returns what it was told — and `useAuth`, because a
// session is a thing only the browser has.

import { DEFAULT_LOCALE, I18nProvider, translate, type TranslationKey } from "@legal-ai/i18n";
import type { Role } from "@legal-ai/db";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { ServiceVersionsPage as PageData, VersionItem } from "../api";
import { ServiceVersionsPage } from "./ServiceVersionsPage";

const api = vi.hoisted(() => ({
  listForService: vi.fn<() => Promise<PageData>>(),
  submitForReview: vi.fn<() => Promise<PageData>>(),
  returnToDraft: vi.fn<() => Promise<PageData>>(),
  release: vi.fn<() => Promise<PageData>>(),
  putOnSale: vi.fn<() => Promise<PageData>>(),
  pause: vi.fn<() => Promise<PageData>>(),
  lift: vi.fn<() => Promise<PageData>>(),
}));

const auth = vi.hoisted(() => ({
  current: { session: null as { user: { id: string } } | null, role: null as Role | null },
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, serviceVersionsApi: api };
});

vi.mock("../../../app/auth", () => ({
  useAuth: () => ({ ...auth.current, loading: false, signOut: async () => {} }),
}));

function text(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(DEFAULT_LOCALE, key, params);
}

const OLENA = { id: "usr-olena", fullName: "Olena Kovalchuk" };
const TARAS = { id: "usr-taras", fullName: "Taras Bondarenko" };
const IRYNA = { id: "usr-admin", fullName: "Iryna Shevchenko" };

function version(overrides: Partial<VersionItem> = {}): VersionItem {
  return {
    id: "sv-1",
    version: 1,
    status: "in_review",
    generationMode: "template",
    reviewMode: "auto",
    priceMinor: 120000,
    currency: "UAH",
    createdAt: "2026-09-01T00:00:00.000Z",
    author: OLENA,
    release: { kind: "none" },
    sale: null,
    openPause: null,
    pauses: [],
    ...overrides,
  };
}

function page(versions: VersionItem[], overrides: Partial<PageData> = {}): PageData {
  return {
    service: {
      id: "svc-divorce",
      title: "Divorce application",
      practiceArea: { code: "family", labels: { uk: "Сімейне право", en: "Family" } },
      practiceAreaCode: "family",
    },
    versions,
    signatories: [
      { lawyer: OLENA, isHead: true },
      { lawyer: TARAS, isHead: false },
    ],
    assignments: [
      { lawyerId: OLENA.id, isPrimary: true },
      { lawyerId: TARAS.id, isPrimary: false },
    ],
    ...overrides,
  };
}

function signIn(who: { id: string }, role: Role) {
  auth.current = { session: { user: { id: who.id } }, role };
}

/** The table, so a name in the signatories section does not answer for a name in a row. */
function table() {
  return within(screen.getByRole("table"));
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/services/svc-divorce/versions"]}>
        <Routes>
          <Route path="/services/:serviceId/versions" element={<ServiceVersionsPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signIn(IRYNA, "admin");
  api.listForService.mockResolvedValue(page([version()]));
});

describe("screen states", () => {
  it("announces the wait", () => {
    api.listForService.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toHaveProperty("textContent", text("versions.loading"));
  });

  it("tells a mistyped id apart from a broken request", async () => {
    api.listForService.mockRejectedValue(new AppError("not_found", "no"));
    renderPage();
    expect(await screen.findByText(text("versions.notFound.title"))).toBeTruthy();
    expect(screen.queryByText(text("versions.failed.title"))).toBeNull();
  });

  it("does not say there are no versions when the request broke", async () => {
    api.listForService.mockRejectedValue(new AppError("network", "no"));
    renderPage();
    expect(await screen.findByText(text("versions.error.network"))).toBeTruthy();
    expect(screen.getByText(text("versions.failed.title"))).toBeTruthy();
    expect(screen.queryByText(text("versions.empty.title"))).toBeNull();
  });

  it("says there are no versions when there are none", async () => {
    api.listForService.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText(text("versions.empty.title"))).toBeTruthy();
  });

  it("retries when asked", async () => {
    api.listForService
      .mockRejectedValueOnce(new AppError("network", "no"))
      .mockResolvedValueOnce(page([version()]));
    renderPage();
    fireEvent.click(await screen.findByText(text("common.tryAgain")));
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(table().getByText(OLENA.fullName)).toBeTruthy();
    expect(api.listForService).toHaveBeenCalledTimes(2);
  });
});

describe("the three names", () => {
  it("renders author, signatory with the self-release flag, and seller", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({
          status: "published",
          release: {
            kind: "signed",
            by: TARAS,
            at: "2026-09-02T00:00:00.000Z",
            selfReleased: true,
          },
          sale: { by: IRYNA, at: "2026-09-03T00:00:00.000Z" },
        }),
      ]),
    );
    renderPage();
    await screen.findByRole("table");
    expect(table().getByText(OLENA.fullName)).toBeTruthy();
    expect(table().getByText(TARAS.fullName)).toBeTruthy();
    expect(table().getByText(IRYNA.fullName)).toBeTruthy();
    expect(table().getByText(text("versions.selfReleased"))).toBeTruthy();
  });

  it("keeps three absences apart: not released, a signature with no name, a name it cannot read", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({ id: "a", version: 3 }),
        version({
          id: "b",
          version: 2,
          status: "archived",
          release: { kind: "unsigned", at: "2026-06-01T00:00:00.000Z" },
          sale: { by: null, at: "2026-06-01T00:00:00.000Z" },
        }),
        version({
          id: "c",
          version: 1,
          status: "draft",
          author: { id: "usr-gone", fullName: null },
        }),
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByLabelText(text("versions.showArchived")));
    // Two versions carry no signature (3 and 1); one carries a date and no name (2).
    expect(table().getAllByText(text("versions.notReleased"))).toHaveLength(2);
    expect(table().getAllByText(text("versions.releasedByNobody"))).toHaveLength(1);
    // The seller with no readable profile, and the author with none.
    expect(table().getAllByText(text("versions.nameUnavailable"))).toHaveLength(2);
  });

  it("hides the archive by default and counts what it hides", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({ id: "a", version: 2 }),
        version({ id: "b", version: 1, status: "archived" }),
      ]),
    );
    renderPage();
    await screen.findByText(text("service.versionShort", { version: 2 }));
    expect(screen.queryByText(text("service.versionShort", { version: 1 }))).toBeNull();
    fireEvent.click(screen.getByLabelText(text("versions.showArchived")));
    expect(screen.getByText(text("service.versionShort", { version: 1 }))).toBeTruthy();
  });

  it("says when nobody signs for the area", async () => {
    api.listForService.mockResolvedValue(page([version()], { signatories: [] }));
    renderPage();
    expect(await screen.findByText(text("versions.signatories.none"))).toBeTruthy();
  });
});

describe("who sees which button", () => {
  it("a signatory who did not write it sees the release button; the admin sees no button", async () => {
    signIn(TARAS, "lawyer");
    renderPage();
    expect(await screen.findByText(text("versions.action.release"))).toBeTruthy();
    expect(screen.queryByText(text("versions.action.putOnSale"))).toBeNull();
  });

  it("the author sees no release button while somebody else signs for the area", async () => {
    signIn(OLENA, "lawyer");
    renderPage();
    expect(await screen.findByText(text("versions.action.backToDraft"))).toBeTruthy();
    expect(screen.queryByText(text("versions.action.release"))).toBeNull();
  });

  it("an admin sees the sale button only once the version is signed", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({
          release: {
            kind: "signed",
            by: TARAS,
            at: "2026-09-02T00:00:00.000Z",
            selfReleased: false,
          },
        }),
      ]),
    );
    renderPage();
    expect(await screen.findByText(text("versions.action.putOnSale"))).toBeTruthy();
    expect(screen.queryByText(text("versions.action.release"))).toBeNull();
  });
});

describe("the acts", () => {
  it("signing asks first, then calls the api and replaces the page with what came back", async () => {
    signIn(TARAS, "lawyer");
    const signed = page([
      version({
        release: { kind: "signed", by: TARAS, at: "2026-09-02T00:00:00.000Z", selfReleased: false },
      }),
    ]);
    api.release.mockResolvedValue(signed);
    renderPage();

    fireEvent.click(await screen.findByText(text("versions.action.release")));
    expect(screen.getByText(text("versions.release.title", { version: 1 }))).toBeTruthy();
    fireEvent.click(screen.getByText(text("versions.release.confirm")));

    await waitFor(() => expect(api.release).toHaveBeenCalledWith("sv-1"));
    await waitFor(() => expect(table().getByText(TARAS.fullName)).toBeTruthy());
    expect(screen.queryByText(text("versions.action.release"))).toBeNull();
  });

  it("a refusal from the database is a sentence, not a saved row", async () => {
    signIn(TARAS, "lawyer");
    api.release.mockRejectedValue(new AppError("validation", "you authored this version"));
    renderPage();

    fireEvent.click(await screen.findByText(text("versions.action.release")));
    fireEvent.click(screen.getByText(text("versions.release.confirm")));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      text("versions.act.error.refused"),
    );
    // The rule's own English never reaches the reader.
    expect(screen.queryByText(/you authored/)).toBeNull();
    expect(screen.getByText(text("versions.action.release"))).toBeTruthy();
  });

  it("pausing takes a reason, and refuses to proceed without one", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({
          status: "published",
          release: {
            kind: "signed",
            by: TARAS,
            at: "2026-09-02T00:00:00.000Z",
            selfReleased: false,
          },
          sale: { by: IRYNA, at: "2026-09-03T00:00:00.000Z" },
        }),
      ]),
    );
    api.pause.mockResolvedValue(page([version({ status: "paused" })]));
    renderPage();

    fireEvent.click(await screen.findByText(text("versions.action.pause")));
    const dialog = within(screen.getByRole("dialog"));
    // An admin's list includes the commercial reason.
    expect(dialog.getByLabelText(text("pause.reason.commercial"))).toBeTruthy();

    fireEvent.click(dialog.getByText(text("versions.pauseDialog.confirm")));
    expect(dialog.getByText(text("versions.pauseDialog.reasonRequired"))).toBeTruthy();
    expect(api.pause).not.toHaveBeenCalled();

    fireEvent.click(dialog.getByLabelText(text("pause.reason.defect")));
    fireEvent.change(dialog.getByLabelText(text("versions.pauseDialog.note")), {
      target: { value: "clause 4" },
    });
    fireEvent.click(dialog.getByText(text("versions.pauseDialog.confirm")));
    await waitFor(() =>
      expect(api.pause).toHaveBeenCalledWith("sv-1", { reason: "defect", note: "clause 4" }),
    );
  });

  it("a refusal while the pause dialog is open is read inside the dialog, which stays open", async () => {
    api.listForService.mockResolvedValue(
      page([
        version({
          status: "published",
          release: {
            kind: "signed",
            by: TARAS,
            at: "2026-09-02T00:00:00.000Z",
            selfReleased: false,
          },
          sale: { by: IRYNA, at: "2026-09-03T00:00:00.000Z" },
        }),
      ]),
    );
    api.pause.mockRejectedValue(new AppError("conflict", "already paused"));
    renderPage();

    fireEvent.click(await screen.findByText(text("versions.action.pause")));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByLabelText(text("pause.reason.defect")));
    fireEvent.click(dialog.getByText(text("versions.pauseDialog.confirm")));

    expect(await dialog.findByRole("alert")).toHaveProperty(
      "textContent",
      text("versions.act.error.conflict"),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("a lawyer's pause dialog does not offer the commercial reason", async () => {
    signIn(TARAS, "lawyer");
    api.listForService.mockResolvedValue(
      page([
        version({
          status: "published",
          release: {
            kind: "signed",
            by: TARAS,
            at: "2026-09-02T00:00:00.000Z",
            selfReleased: false,
          },
          sale: { by: IRYNA, at: "2026-09-03T00:00:00.000Z" },
        }),
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByText(text("versions.action.pause")));
    expect(screen.getByLabelText(text("pause.reason.defect"))).toBeTruthy();
    expect(screen.queryByLabelText(text("pause.reason.commercial"))).toBeNull();
  });

  it("lifting a professional pause is a signatory's act, offered as resumed or archived", async () => {
    signIn(TARAS, "lawyer");
    api.listForService.mockResolvedValue(
      page([
        version({
          status: "paused",
          sale: { by: IRYNA, at: "2026-09-03T00:00:00.000Z" },
          openPause: {
            id: "pause-1",
            reason: "defect",
            note: null,
            openedBy: OLENA,
            openedAt: "2026-09-04T00:00:00.000Z",
            outcome: { kind: "open" },
          },
          pauses: [],
        }),
      ]),
    );
    api.lift.mockResolvedValue(page([version({ status: "published" })]));
    renderPage();

    fireEvent.click(await screen.findByText(text("versions.action.lift")));
    fireEvent.click(screen.getByLabelText(text("versions.liftDialog.resumed")));
    fireEvent.click(screen.getByText(text("versions.liftDialog.confirm")));
    await waitFor(() => expect(api.lift).toHaveBeenCalledWith("pause-1", "resumed"));
  });
});
