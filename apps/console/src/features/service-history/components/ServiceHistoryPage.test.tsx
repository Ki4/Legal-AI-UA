// The §4 states, which is the half of this screen no type can decide.
//
// Four of the branches below return an `EmptyState` and all four compile. The
// only thing separating "nothing has ever happened to this service" from "you
// may not see what happened" from "the request broke" is which sentence a
// lawyer reads, and this file is the only thing that checks it.
//
// The seam is `../api`, the feature's own contract, and `../../../app/auth`,
// because whether the empty result needs explaining depends on the reader's
// role — an admin's empty history is empty, a lawyer's may be a policy.

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
import type { ServiceHistoryEvent, ServiceHistoryPage as Page } from "../api";
import { ServiceHistoryPage } from "./ServiceHistoryPage";

const { get, isAttached, auth } = vi.hoisted(() => ({
  // Typed with the contract's real signature, not `() => …`: the paging case
  // below asserts on the *limit* the screen asked for, and an argument list the
  // mock does not know about is one the compiler will not let it read.
  get: vi.fn<(serviceId: string, limit: number) => Promise<Page>>(),
  isAttached: vi.fn<(serviceId: string) => Promise<boolean>>(),
  // Mutable rather than a second mock factory: the role is an input to almost
  // every case below, and rebuilding the module per test would be a slower way
  // to change one field.
  auth: { role: "admin" as "admin" | "lawyer" | null },
}));

vi.mock("../api", () => ({ serviceHistoryApi: { get, isAttached } }));

vi.mock("../../../app/auth", () => ({
  useAuth: () => ({ role: auth.role, session: null, loading: false, signOut: async () => {} }),
}));

const t = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

function event(overrides: Partial<ServiceHistoryEvent> = {}): ServiceHistoryEvent {
  return {
    id: 1,
    occurredAt: "2026-08-11T09:00:00.000Z",
    action: "update",
    entity: "service_versions",
    entityTable: "service_versions",
    entityId: "sv-1",
    changedColumns: ["status"],
    actor: {
      kind: "person",
      id: "usr-admin",
      fullName: "Iryna Shevchenko",
      roleAtTheTime: "admin",
    },
    ...overrides,
  };
}

function page(overrides: Partial<Page> = {}): Page {
  return {
    serviceId: "svc-1",
    serviceTitle: "Divorce application",
    events: [],
    hasMore: false,
    ...overrides,
  };
}

function renderHistory() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/services/svc-1/history"]}>
        <Routes>
          <Route path="/services/:serviceId/history" element={<ServiceHistoryPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("ServiceHistoryPage", () => {
  beforeEach(() => {
    get.mockReset();
    isAttached.mockReset();
    auth.role = "admin";
  });

  it("announces the wait rather than showing an empty log", () => {
    // Never resolves: the loading state is the whole subject, and a promise
    // that settles would make this a race against the assertion.
    get.mockReturnValue(new Promise(() => {}));

    renderHistory();

    expect(screen.getByRole("status").textContent).toContain(t("history.loading"));
    expect(screen.queryByText(t("history.empty.title"))).toBeNull();
  });

  it("renders what arrived, and says how much of it is on screen", async () => {
    get.mockResolvedValue(page({ events: [event(), event({ id: 2 })] }));

    renderHistory();

    // All of them, not one: two events by the same person are two rows, and
    // `findByText` would fail on the second rather than on a missing first.
    expect(await screen.findAllByText("Iryna Shevchenko")).toHaveLength(2);
    expect(screen.getAllByText(t("history.entity.service_versions"))).toHaveLength(2);
    expect(screen.getByText(translatePlural(DEFAULT_LOCALE, "history.shown", 2))).toBeDefined();
  });

  it("links back to the service it is the history of", async () => {
    get.mockResolvedValue(page({ events: [event()] }));

    renderHistory();

    const link = await screen.findByRole("link", { name: "Divorce application" });
    expect(link.getAttribute("href")).toBe("/services/svc-1");
  });

  it("says the log is empty when an admin sees nothing", async () => {
    get.mockResolvedValue(page());

    renderHistory();

    expect(await screen.findByText(t("history.empty.title"))).toBeDefined();
    // An admin reads every service's events, so there is nothing to ask.
    expect(isAttached).not.toHaveBeenCalled();
    expect(screen.queryByText(t("history.restricted.title"))).toBeNull();
    expect(screen.queryByText(t("history.failed.title"))).toBeNull();
  });

  it("tells an unattached lawyer that the log is hidden, not that it is empty", async () => {
    auth.role = "lawyer";
    get.mockResolvedValue(page());
    isAttached.mockResolvedValue(false);

    renderHistory();

    // The case the whole `isAttached` operation exists for. Rendered as an
    // empty log this says a colleague's service has never been touched.
    expect(await screen.findByText(t("history.restricted.title"))).toBeDefined();
    expect(screen.queryByText(t("history.empty.title"))).toBeNull();
  });

  it("says the log is empty when an attached lawyer genuinely sees nothing", async () => {
    auth.role = "lawyer";
    get.mockResolvedValue(page());
    isAttached.mockResolvedValue(true);

    renderHistory();

    expect(await screen.findByText(t("history.empty.title"))).toBeDefined();
    expect(screen.queryByText(t("history.restricted.title"))).toBeNull();
  });

  it("does not ask about the assignment when there is a history to show", async () => {
    auth.role = "lawyer";
    get.mockResolvedValue(page({ events: [event()] }));

    renderHistory();

    await screen.findByText("Iryna Shevchenko");
    // A non-empty result has already proved the caller may read.
    expect(isAttached).not.toHaveBeenCalled();
  });

  it("distinguishes a failed request from an empty log", async () => {
    get.mockRejectedValue(new AppError("network", "getaddrinfo ENOTFOUND db.example"));

    renderHistory();

    expect(await screen.findByText(t("history.error.network"))).toBeDefined();
    expect(screen.getByText(t("history.failed.title"))).toBeDefined();
    expect(screen.queryByText(t("history.empty.title"))).toBeNull();
    // `AppError.message` is developer text and always English. The rule is that
    // it never reaches a lawyer; this is the rule as an assertion.
    expect(screen.queryByText(/ENOTFOUND/)).toBeNull();
  });

  it("offers no retry for a service that does not exist", async () => {
    get.mockRejectedValue(new AppError("not_found", "No service with id svc-1."));

    renderHistory();

    expect(await screen.findByText(t("history.error.notFound"))).toBeDefined();
    // A mistyped id does not become a different id by being asked twice.
    expect(screen.queryByRole("button", { name: t("common.tryAgain") })).toBeNull();
    // And it does not borrow the failed-request panel either. That panel's hint
    // ends by telling the reader to try again, which read as an instruction
    // beside no button to follow it with — found by looking at the screen, not
    // by any gate.
    expect(screen.queryByText(t("history.failed.hint"))).toBeNull();
    expect(screen.getByText(t("history.gone.hint"))).toBeDefined();
  });

  it("retries when asked, because the sentence promises something to try", async () => {
    get.mockRejectedValueOnce(new AppError("network", "no route to host"));
    get.mockResolvedValue(page({ events: [event()] }));

    renderHistory();

    fireEvent.click(await screen.findByRole("button", { name: t("common.tryAgain") }));

    expect(await screen.findByText("Iryna Shevchenko")).toBeDefined();
    expect(screen.queryByText(t("history.error.network"))).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("asks for a wider page rather than a next one", async () => {
    get.mockResolvedValue(page({ events: [event()], hasMore: true }));

    renderHistory();

    fireEvent.click(await screen.findByRole("button", { name: t("history.showMore") }));

    // A log is read downwards. The second request covers the first one's rows
    // as well, so nothing the reader has already seen moves.
    expect(get.mock.calls[0]?.[1]).toBe(50);
    expect(get.mock.calls[1]?.[1]).toBe(100);
  });

  it("does not offer more when there is none", async () => {
    get.mockResolvedValue(page({ events: [event()], hasMore: false }));

    renderHistory();

    await screen.findByText("Iryna Shevchenko");
    expect(screen.queryByRole("button", { name: t("history.showMore") })).toBeNull();
  });

  it("shows the raw table name for a table with no word for it", async () => {
    get.mockResolvedValue(
      page({
        events: [event({ entity: null, entityTable: "service_law_references" })],
      }),
    );

    renderHistory();

    // An empty cell would hide that the log knows something the screen does not.
    expect(await screen.findByText("service_law_references")).toBeDefined();
  });

  it("keeps an unnamed actor apart from no actor", async () => {
    get.mockResolvedValue(
      page({
        events: [
          event({ id: 1, actor: { kind: "unnamed", id: "usr-gone", roleAtTheTime: "lawyer" } }),
          event({ id: 2, actor: { kind: "system", roleAtTheTime: null } }),
        ],
      }),
    );

    renderHistory();

    expect(await screen.findByText(t("history.actor.unnamed"))).toBeDefined();
    expect(screen.getByText(t("history.actor.system"))).toBeDefined();
  });
});
