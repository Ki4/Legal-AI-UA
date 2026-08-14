// The contract's behaviour, asserted without a database.
//
// Every rule here is one both implementations have to hold: the order events
// come back in, what "there is more" means, which of the three actor states a
// row produces, and what happens to a table nobody has a word for. The Supabase
// implementation is checked against the same claims in its own file — these are
// the ones that are decidable from fixtures alone.

import { describe, expect, it } from "vitest";
import { AppError } from "../../../shared/api/errors";
import { mockServiceHistoryApi } from "./service-history.mock";

const DIVORCE = "svc-divorce";

describe("mockServiceHistoryApi.get", () => {
  it("returns the newest first, and settles a tied timestamp by id", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);

    // Two of these share an `occurred_at` to the millisecond, because the
    // service and its first assignment were written in one transaction. Sorting
    // by time alone would leave their order to whatever the source returned.
    expect(page.events.map((event) => event.id)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it("says there is more without returning it", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 3);

    expect(page.events.map((event) => event.id)).toEqual([7, 6, 5]);
    expect(page.hasMore).toBe(true);
  });

  it("does not claim there is more when the page happens to be full", async () => {
    // Exactly seven events exist. A limit of seven fills the page completely,
    // which is the case a naive `length === limit` check gets wrong.
    const page = await mockServiceHistoryApi.get(DIVORCE, 7);

    expect(page.events).toHaveLength(7);
    expect(page.hasMore).toBe(false);
  });

  it("holds the service apart from its events", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);

    expect(page.serviceId).toBe(DIVORCE);
    expect(page.serviceTitle).toBe("Divorce application");
  });

  it("names the actor when the profile can be read", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);
    const event = page.events.find((candidate) => candidate.id === 1);

    expect(event?.actor).toEqual({
      kind: "person",
      id: "usr-admin",
      fullName: "Iryna Shevchenko",
      roleAtTheTime: "admin",
    });
  });

  it("says somebody acted when their profile cannot be read", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);
    const event = page.events.find((candidate) => candidate.id === 5);

    // Not "system", and not a blank. The role they held survives even when the
    // name does not, which is most of what §6.2 asks the log to answer.
    expect(event?.actor).toEqual({
      kind: "unnamed",
      id: "usr-departed",
      roleAtTheTime: "lawyer",
    });
  });

  it("does not attribute a change nobody made to a person", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);
    const event = page.events.find((candidate) => candidate.id === 6);

    expect(event?.actor).toEqual({ kind: "system", roleAtTheTime: null });
  });

  it("keeps the raw table name when there is no word for it", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);
    const event = page.events.find((candidate) => candidate.id === 7);

    // The screen renders `entityTable` when `entity` is null. Losing one of the
    // two here would turn a table added by a future migration into an empty
    // cell — the log knowing something the screen refuses to say.
    expect(event?.entity).toBeNull();
    expect(event?.entityTable).toBe("service_law_references");
  });

  it("carries the columns an update touched and nothing for the rest", async () => {
    const page = await mockServiceHistoryApi.get(DIVORCE, 50);

    expect(page.events.find((event) => event.id === 4)?.changedColumns).toEqual([
      "published_at",
      "published_by",
      "status",
    ]);
    // An insert changes the whole row, so naming its columns says nothing. The
    // null the log holds becomes an empty array once, here, rather than being
    // handled by every reader of the view model.
    expect(page.events.find((event) => event.id === 1)?.changedColumns).toEqual([]);
  });

  it("shows one service's events and not another's", async () => {
    const page = await mockServiceHistoryApi.get("svc-alimony", 50);

    expect(page.events.map((event) => event.id)).toEqual([8]);
  });

  it("returns an empty history rather than failing for a service older than the log", async () => {
    const page = await mockServiceHistoryApi.get("svc-poa", 50);

    // Not an error. Four domain tables shipped before ADR-0010's table did, so
    // a service with no events is an ordinary state and the screen has a
    // sentence for it.
    expect(page.events).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.serviceTitle).toBe("Power of attorney");
  });

  it("refuses an id no service has", async () => {
    // The distinction the screen needs: a mistyped id and an empty history are
    // different screens (DoD §4).
    await expect(mockServiceHistoryApi.get("svc-nonexistent", 50)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(mockServiceHistoryApi.get("svc-nonexistent", 50)).rejects.toBeInstanceOf(AppError);
  });
});

describe("mockServiceHistoryApi.isAttached", () => {
  it("is true for a service the caller is accountable for", async () => {
    await expect(mockServiceHistoryApi.isAttached(DIVORCE)).resolves.toBe(true);
  });

  it("is false for a colleague's service", async () => {
    // The whole reason the operation exists: this caller's empty history for
    // svc-alimony is the policy working, not an empty log.
    await expect(mockServiceHistoryApi.isAttached("svc-alimony")).resolves.toBe(false);
  });

  it("is false for a service nobody is attached to", async () => {
    await expect(mockServiceHistoryApi.isAttached("svc-poa")).resolves.toBe(false);
  });
});
