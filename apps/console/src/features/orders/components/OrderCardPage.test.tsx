// The §4 states, and the three that only this screen has.
//
// Two of them are the same shape as everywhere else — a mistyped id is not a
// broken request, a broken request is not an empty order. The third is new and
// is the reason ADR-0019 exists on a screen rather than only in a migration: an
// entitlement that is *recorded and not readable* must not render like one that
// was never bought. A lawyer meets that state on every paid order they open,
// and no type can tell the two apart.

import { DEFAULT_LOCALE, I18nProvider, translate, type TranslationKey } from "@legal-ai/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { OrderCard } from "../api";
import { OrderCardPage } from "./OrderCardPage";

const { get } = vi.hoisted(() => ({
  get: vi.fn<(orderId: string) => Promise<OrderCard>>(),
}));

vi.mock("../api", () => ({ ordersApi: { get } }));

const t = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

function card(overrides: Partial<OrderCard> = {}): OrderCard {
  return {
    id: "ord-1",
    clientPseudonym: "client-4f2a91",
    status: "in_review",
    humanReviewRequested: false,
    reviewer: { kind: "person", id: "usr-olena", fullName: "Олена" },
    entitlement: { kind: "none" },
    pinned: {
      serviceId: "svc-divorce",
      serviceTitle: "Розірвання шлюбу",
      versionId: "sv-2",
      version: 2,
      status: "published",
      generationMode: "full_generation",
      reviewMode: "lawyer_required",
      frozen: true,
    },
    placedAt: "2026-08-10T09:15:00.000Z",
    submittedAt: "2026-08-10T09:40:00.000Z",
    deliveredAt: null,
    closedAt: null,
    timeline: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/orders/ord-1"]}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderCardPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
});

describe("OrderCardPage", () => {
  it("announces the load rather than showing an empty card", async () => {
    let settle: (order: OrderCard) => void = () => {};
    get.mockReturnValue(new Promise<OrderCard>((resolve) => (settle = resolve)));

    renderPage();

    expect(screen.getByRole("status").textContent).toContain(t("order.loading"));

    settle(card());
    await screen.findByText("client-4f2a91");
  });

  it("names the client by pseudonym and shows the state", async () => {
    get.mockResolvedValue(card());

    renderPage();

    expect(await screen.findByText("client-4f2a91")).toBeDefined();
    expect(screen.getByText(t("order.status.in_review"))).toBeDefined();
  });

  it("says the pinned version is frozen, because that is what makes the pin mean anything", async () => {
    get.mockResolvedValue(card());

    renderPage();

    expect(await screen.findByText(t("order.pinned.frozen"))).toBeDefined();
    expect(screen.getByText("v2")).toBeDefined();
  });

  it("does not claim a version is frozen when it is not", async () => {
    get.mockResolvedValue(card({ pinned: { ...card().pinned, frozen: false, status: "draft" } }));

    renderPage();

    await screen.findByText("client-4f2a91");
    expect(screen.queryByText(t("order.pinned.frozen"))).toBeNull();
  });

  it("says nothing is paid for when nothing is", async () => {
    get.mockResolvedValue(card({ entitlement: { kind: "none" } }));

    renderPage();

    expect(await screen.findByText(t("order.entitlement.none"))).toBeDefined();
    expect(screen.queryByText(t("order.entitlement.withheld"))).toBeNull();
  });

  it("says a purchase is administration's to read, not that there is none", async () => {
    // ADR-0019 on a screen. A lawyer reads `entitlement_id` and cannot read the
    // row; rendering that as "not paid for yet" tells them something false
    // about an order that has been paid for. The pair with the case above is
    // the point — either alone passes against a screen that renders both blank.
    get.mockResolvedValue(card({ entitlement: { kind: "withheld" } }));

    renderPage();

    expect(await screen.findByText(t("order.entitlement.withheld"))).toBeDefined();
    expect(screen.queryByText(t("order.entitlement.none"))).toBeNull();
  });

  it("shows a one-off as valid until the law changes, with no date", async () => {
    get.mockResolvedValue(
      card({
        entitlement: {
          kind: "known",
          id: "ent-1",
          entitlementKind: "one_off",
          validUntil: null,
          revokedAt: null,
        },
      }),
    );

    renderPage();

    // §8.1: its lifetime is a function of legislation, not of a date, so the
    // absence of a date is the answer rather than a gap.
    expect(await screen.findByText(t("order.entitlement.untilLawChanges"))).toBeDefined();
  });

  it("shows a revoked purchase as revoked, not as a term still running", async () => {
    get.mockResolvedValue(
      card({
        entitlement: {
          kind: "known",
          id: "ent-2",
          entitlementKind: "subscription",
          validUntil: "2027-08-01T08:00:00.000Z",
          revokedAt: "2026-08-07T09:00:00.000Z",
        },
      }),
    );

    renderPage();

    // The distinction `revoked_at` exists for: the term still says it runs for
    // another year, and coverage stopped.
    expect(await screen.findByText(t("order.entitlement.revoked"))).toBeDefined();
    expect(screen.queryByText(t("order.entitlement.until"))).toBeNull();
  });

  it("tells an unclaimed order from one whose reviewer is hidden", async () => {
    get.mockResolvedValue(card({ reviewer: { kind: "none" } }));

    renderPage();

    expect(await screen.findByText(t("orders.reviewer.none"))).toBeDefined();
    expect(screen.queryByText(t("orders.reviewer.unnamed"))).toBeNull();
  });

  it("shows the Art. 22 request beside the state", async () => {
    get.mockResolvedValue(card({ status: "generating", humanReviewRequested: true }));

    renderPage();

    expect(await screen.findByText(t("order.status.generating"))).toBeDefined();
    expect(screen.getByText(t("orders.humanReview"))).toBeDefined();
  });

  it("renders the timeline as states, not as column names, when an event moved one", async () => {
    get.mockResolvedValue(
      card({
        timeline: [
          {
            id: 2,
            occurredAt: "2026-08-10T09:40:00.000Z",
            action: "update",
            changedColumns: ["status", "updated_at"],
            statusAfter: "submitted",
            actor: { kind: "person", id: "usr-olena", fullName: "Олена", roleAtTheTime: "lawyer" },
          },
        ],
      }),
    );

    renderPage();

    // §6.1: the state on the card and this badge are the same fact reached from
    // opposite ends, which is what "status is a projection of the log" means.
    expect(await screen.findByText(t("order.status.submitted"))).toBeDefined();
    expect(screen.queryByText("status, updated_at")).toBeNull();
  });

  it("falls back to column names for an event that moved no state", async () => {
    get.mockResolvedValue(
      card({
        timeline: [
          {
            id: 3,
            occurredAt: "2026-08-10T10:05:00.000Z",
            action: "update",
            changedColumns: ["reviewer_id", "updated_at"],
            statusAfter: null,
            actor: { kind: "unnamed", id: "usr-departed", roleAtTheTime: "lawyer" },
          },
        ],
      }),
    );

    renderPage();

    expect(await screen.findByText("reviewer_id, updated_at")).toBeDefined();
    expect(screen.getByText(t("history.actor.unnamed"))).toBeDefined();
  });

  it("says an empty timeline is empty rather than rendering an empty table", async () => {
    get.mockResolvedValue(card({ timeline: [] }));

    renderPage();

    expect(await screen.findByText(t("order.timeline.empty.title"))).toBeDefined();
  });

  it("does not offer a retry for an order that does not exist", async () => {
    get.mockRejectedValue(new AppError("not_found", "gone"));

    renderPage();

    expect(await screen.findByText(t("order.error.notFound"))).toBeDefined();
    // The sentence ends in no invitation to try again, because there is no
    // button beside it — the failure the history screen shipped and had to fix.
    expect(screen.queryByRole("button", { name: t("common.tryAgain") })).toBeNull();
  });

  it("offers a retry for a request that broke, and does not call it not found", async () => {
    get.mockRejectedValue(new AppError("network", "down"));

    renderPage();

    expect(await screen.findByText(t("order.error.network"))).toBeDefined();
    expect(screen.queryByText(t("order.error.notFound"))).toBeNull();
    expect(screen.getByRole("button", { name: t("common.tryAgain") })).toBeDefined();
  });

  it("retries when asked", async () => {
    get.mockRejectedValueOnce(new AppError("network", "down"));
    get.mockResolvedValue(card());

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: t("common.tryAgain") }));

    expect(await screen.findByText("client-4f2a91")).toBeDefined();
  });

  it("falls back to the generic failure for an unmapped error", async () => {
    get.mockRejectedValue(new Error("something the layer did not wrap"));

    renderPage();

    expect(await screen.findByText(t("order.error.load"))).toBeDefined();
  });
});
