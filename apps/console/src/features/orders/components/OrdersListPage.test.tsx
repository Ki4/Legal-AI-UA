// The §4 states, which is the half of this screen no type can decide.
//
// Three of the branches below return an `EmptyState` and all three compile. The
// only thing separating "there are no orders" from "none of them are yours"
// from "the request broke" is which sentence a lawyer reads — and on this
// screen the first of those is the *expected* answer today, because nothing
// writes orders until the gateway does (ADM-5). That is what makes the mix-up
// likely rather than hypothetical: the honest empty state and the misleading
// one look identical.
//
// The seam is `../api`, the feature's own contract, and `../../../app/auth`,
// because whether an empty list needs explaining depends on the reader's role.

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
import type { OrderListItem, OrdersPage } from "../api";
import { OrdersListPage } from "./OrdersListPage";

const { list, hasAnyAssignment, auth } = vi.hoisted(() => ({
  // Typed with the contract's real signature, not `() => …`: the paging case
  // asserts on the limit the screen asked for, and an argument list the mock
  // does not know about is one the compiler will not let it read.
  list: vi.fn<(limit: number) => Promise<OrdersPage>>(),
  hasAnyAssignment: vi.fn<() => Promise<boolean>>(),
  auth: { role: "admin" as "admin" | "lawyer" | null },
}));

vi.mock("../api", () => ({ ordersApi: { list, hasAnyAssignment } }));

vi.mock("../../../app/auth", () => ({
  useAuth: () => ({ role: auth.role, session: null, loading: false, signOut: async () => {} }),
}));

const t = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "ord-1",
    clientPseudonym: "client-4f2a91",
    serviceId: "svc-divorce",
    serviceTitle: "Розірвання шлюбу",
    version: 2,
    status: "in_review",
    humanReviewRequested: false,
    reviewer: { kind: "person", id: "usr-olena", fullName: "Олена" },
    placedAt: "2026-08-10T09:15:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/orders"]}>
        <OrdersListPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  list.mockReset();
  hasAnyAssignment.mockReset();
  auth.role = "admin";
});

describe("OrdersListPage", () => {
  it("announces the load rather than showing an empty table", async () => {
    let settle: (page: OrdersPage) => void = () => {};
    list.mockReturnValue(new Promise<OrdersPage>((resolve) => (settle = resolve)));

    renderPage();

    expect(screen.getByRole("status").textContent).toContain(t("orders.loading"));

    settle({ orders: [], hasMore: false });
    await screen.findByText(t("orders.empty.title"));
  });

  it("renders the orders it was given", async () => {
    list.mockResolvedValue({ orders: [order()], hasMore: false });

    renderPage();

    expect(await screen.findByText("client-4f2a91")).toBeDefined();
    expect(screen.getByText(t("order.status.in_review"))).toBeDefined();
    expect(screen.getByText("Олена")).toBeDefined();
    expect(screen.getByText(translatePlural(DEFAULT_LOCALE, "orders.shown", 1))).toBeDefined();
  });

  it("says an order nobody took is untaken, not that its reviewer is hidden", async () => {
    list.mockResolvedValue({ orders: [order({ reviewer: { kind: "none" } })], hasMore: false });

    renderPage();

    expect(await screen.findByText(t("orders.reviewer.none"))).toBeDefined();
    expect(screen.queryByText(t("orders.reviewer.unnamed"))).toBeNull();
  });

  it("says a reviewer it cannot name is hidden, not that nobody took it", async () => {
    // The pair above and below are the point of splitting the state. Either one
    // alone passes against a screen that renders both the same way.
    list.mockResolvedValue({
      orders: [order({ reviewer: { kind: "unnamed", id: "usr-departed" } })],
      hasMore: false,
    });

    renderPage();

    expect(await screen.findByText(t("orders.reviewer.unnamed"))).toBeDefined();
    expect(screen.queryByText(t("orders.reviewer.none"))).toBeNull();
  });

  it("shows the Art. 22 request beside the state, not instead of it", async () => {
    list.mockResolvedValue({
      orders: [order({ status: "generating", humanReviewRequested: true })],
      hasMore: false,
    });

    renderPage();

    expect(await screen.findByText(t("order.status.generating"))).toBeDefined();
    expect(screen.getByText(t("orders.humanReview"))).toBeDefined();
  });

  it("tells an admin the list is empty, and offers nothing to create", async () => {
    list.mockResolvedValue({ orders: [], hasMore: false });

    renderPage();

    expect(await screen.findByText(t("orders.empty.title"))).toBeDefined();
    expect(screen.getByText(t("orders.empty.hint"))).toBeDefined();
    expect(hasAnyAssignment).not.toHaveBeenCalled();
  });

  it("tells a lawyer attached to nothing that the list is not theirs to see", async () => {
    auth.role = "lawyer";
    list.mockResolvedValue({ orders: [], hasMore: false });
    hasAnyAssignment.mockResolvedValue(false);

    renderPage();

    // The whole reason `hasAnyAssignment` exists: this reader gets the same
    // empty array an empty platform gives, and the wrong sentence would tell
    // them the firm has no clients.
    expect(await screen.findByText(t("orders.restricted.title"))).toBeDefined();
    expect(screen.queryByText(t("orders.empty.title"))).toBeNull();
  });

  it("tells a lawyer who is attached that there really are none", async () => {
    auth.role = "lawyer";
    list.mockResolvedValue({ orders: [], hasMore: false });
    hasAnyAssignment.mockResolvedValue(true);

    renderPage();

    expect(await screen.findByText(t("orders.empty.title"))).toBeDefined();
    expect(screen.queryByText(t("orders.restricted.title"))).toBeNull();
  });

  it("does not ask about assignments when the list came back with rows", async () => {
    auth.role = "lawyer";
    list.mockResolvedValue({ orders: [order()], hasMore: false });

    renderPage();

    await screen.findByText("client-4f2a91");
    // A non-empty result has already proved the caller may read.
    expect(hasAnyAssignment).not.toHaveBeenCalled();
  });

  it("does not render a failed load as an empty list", async () => {
    list.mockRejectedValue(new AppError("network", "down"));

    renderPage();

    expect(await screen.findByText(t("orders.error.network"))).toBeDefined();
    expect(screen.getByText(t("orders.failed.title"))).toBeDefined();
    // The mistake DoD §4 names as the most repeatable one on this shape of
    // screen, and the one this whole file exists to catch.
    expect(screen.queryByText(t("orders.empty.title"))).toBeNull();
  });

  it("falls back to the generic failure for an unmapped error", async () => {
    list.mockRejectedValue(new Error("something the layer did not wrap"));

    renderPage();

    expect(await screen.findByText(t("orders.error.load"))).toBeDefined();
  });

  it("retries the load when asked", async () => {
    list.mockRejectedValueOnce(new AppError("network", "down"));
    list.mockResolvedValue({ orders: [order()], hasMore: false });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: t("common.tryAgain") }));

    expect(await screen.findByText("client-4f2a91")).toBeDefined();
    expect(screen.queryByText(t("orders.failed.title"))).toBeNull();
  });

  it("asks for another page without losing the reader's place", async () => {
    list.mockResolvedValue({ orders: [order()], hasMore: true });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: t("orders.showMore") }));

    // A wider limit, not a page offset: the log is read downwards, and a reader
    // at the bottom wants the next stretch rather than a page to keep a place in.
    expect(list).toHaveBeenLastCalledWith(100);
    // Still on screen while the wider request runs — never blanked to a spinner.
    expect(screen.getByText("client-4f2a91")).toBeDefined();
  });

  it("offers no way to ask for more when there is no more", async () => {
    list.mockResolvedValue({ orders: [order()], hasMore: false });

    renderPage();

    await screen.findByText("client-4f2a91");
    expect(screen.queryByRole("button", { name: t("orders.showMore") })).toBeNull();
  });
});
