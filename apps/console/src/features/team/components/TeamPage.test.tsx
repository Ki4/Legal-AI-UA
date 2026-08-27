// The §4 states of the team screen — the half no type can decide.
//
// Written on 2026-08-27 with the states themselves, closing a debt carried since
// 2026-08-13. What this screen did before was render a line of text while
// loading and an empty `<ul>` for everything else, so "nobody has registered
// yet" and "the request failed" were the same picture. An admin meeting that
// picture reads the first, because for a firm of three it is the plausible one —
// which is what makes the collapse dangerous rather than untidy.
//
// The seam is the feature's own `api/`, mocked outright: which sentence a
// refusal gets is a property of this component, and routing it through the
// fixture would test the fixture.

import { DEFAULT_LOCALE, I18nProvider, translate, type TranslationKey } from "@legal-ai/i18n";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { TeamMember } from "../api";
import { TeamPage } from "./TeamPage";

const { list, approve } = vi.hoisted(() => ({
  list: vi.fn<() => Promise<TeamMember[]>>(),
  approve: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, teamApi: { list, approve } };
});

const text = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "usr-1",
    email: "olena@example.test",
    fullName: "Олена",
    role: "lawyer",
    awaitingApproval: false,
    joinedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

const renderPage = () =>
  render(
    <I18nProvider>
      <TeamPage />
    </I18nProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([member()]);
});

describe("screen states", () => {
  it("reserves the shape of the list rather than showing an empty one", () => {
    list.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getByRole("status").textContent).toBe(text("team.loading"));
    // The bars themselves say nothing to a screen reader, and should not.
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("renders what arrived", async () => {
    renderPage();

    expect(await screen.findByText("Олена")).toBeTruthy();
    expect(screen.getByText("olena@example.test")).toBeTruthy();
  });

  it("says the team is empty when it is", async () => {
    list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(text("team.empty.title"))).toBeTruthy();
  });

  it("does not say the team is empty when the request broke", async () => {
    // The debt this screen carried, and the mistake DoD §4 names as the most
    // repeatable one. The second assertion is the one that catches a regression.
    list.mockRejectedValue(new AppError("unknown", "boom"));
    renderPage();

    expect(await screen.findByText(text("team.failed.title"))).toBeTruthy();
    expect(screen.queryByText(text("team.empty.title"))).toBeNull();
  });

  it("separates a refusal from a request that never completed", async () => {
    list.mockRejectedValue(new AppError("forbidden", "nope"));
    renderPage();
    expect(await screen.findByText(text("team.error.forbidden"))).toBeTruthy();

    list.mockRejectedValue(new AppError("network", "nope"));
    fireEvent.click(screen.getByRole("button", { name: text("common.tryAgain") }));
    expect(await screen.findByText(text("team.error.network"))).toBeTruthy();
  });

  it("clears the failure when a retry succeeds, rather than stacking states", async () => {
    // The retry button exists only in the error state — there is nothing to
    // refresh from when the screen is healthy — so this is the reachable half of
    // "a second attempt": failed load, retry, list. What it guards is the
    // failure sentence and the failed-load empty state both going away, instead
    // of sitting above rows that loaded perfectly well.
    list.mockRejectedValueOnce(new AppError("network", "nope"));
    renderPage();

    expect(await screen.findByText(text("team.error.network"))).toBeTruthy();
    expect(screen.getByText(text("team.failed.title"))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: text("common.tryAgain") }));

    expect(await screen.findByText("Олена")).toBeTruthy();
    expect(screen.queryByText(text("team.error.network"))).toBeNull();
    expect(screen.queryByText(text("team.failed.title"))).toBeNull();
  });
});

describe("approving a registration", () => {
  const waiting = member({
    id: "usr-2",
    email: "new@example.test",
    fullName: null,
    role: null,
    awaitingApproval: true,
  });

  it("offers both roles only to somebody waiting", async () => {
    list.mockResolvedValue([member(), waiting]);
    renderPage();

    await screen.findByText("Олена");
    expect(screen.getAllByRole("button", { name: text("team.approveAsLawyer") })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: text("team.approveAsAdmin") })).toHaveLength(1);
  });

  it("replaces the one row rather than reloading the screen", async () => {
    // ADR-0012 convention 5: the mutation returns the updated entity. Asserted
    // because the cost of getting it wrong is invisible — a reload works, and
    // throws away the admin's scroll position to learn one field.
    list.mockResolvedValue([waiting]);
    approve.mockResolvedValue({ ...waiting, role: "lawyer", awaitingApproval: false });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: text("team.approveAsLawyer") }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith("usr-2", "lawyer"));
    expect(list).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("lawyer")).toBeTruthy();
  });

  it("tells a failed approval apart from a failed load", async () => {
    list.mockResolvedValue([waiting]);
    approve.mockRejectedValue(new AppError("conflict", "someone else did"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: text("team.approveAsLawyer") }));

    expect(await screen.findByText(text("team.error.conflict"))).toBeTruthy();
    expect(screen.queryByText(text("team.error.load"))).toBeNull();
  });

  it("shows the absence of a role as a sentence, and the role itself as the system holds it", async () => {
    // `admin` and `lawyer` are the words an RLS policy and the JWT are written
    // in, so they render raw; only "waiting" is ours to phrase.
    list.mockResolvedValue([waiting]);
    renderPage();

    expect(await screen.findByText(text("team.pending"))).toBeTruthy();
  });
});
