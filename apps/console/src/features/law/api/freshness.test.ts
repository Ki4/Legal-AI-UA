// §9.10 is the rule this file exists for: "no difference found" and "no check
// completed" must never render alike, and a norm not successfully checked for
// several times its interval is an alarm of its own.
//
// `now` is passed in rather than mocked, because the function takes it. A test
// that froze the clock would be testing the mock.

import { describe, expect, it } from "vitest";
import { freshnessOf, STALE_AFTER_INTERVALS } from "./freshness";

const NOW = Date.parse("2026-08-15T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAILY = 24;

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString();
}

describe("freshnessOf", () => {
  it("calls a norm that has never been verified exactly that", () => {
    expect(freshnessOf(null, DAILY, NOW)).toEqual({ kind: "never_checked" });
  });

  it("keeps a recent verification fresh", () => {
    const verifiedAt = hoursAgo(1);
    expect(freshnessOf(verifiedAt, DAILY, NOW)).toEqual({ kind: "fresh", verifiedAt });
  });

  it("is still fresh one hour before the deadline", () => {
    const verifiedAt = hoursAgo(DAILY * STALE_AFTER_INTERVALS - 1);
    expect(freshnessOf(verifiedAt, DAILY, NOW)).toEqual({ kind: "fresh", verifiedAt });
  });

  // The boundary, stated as its own case: `now > deadline`, so landing exactly
  // on it is not yet stale. Either answer would be defensible; the test is here
  // so the choice is a decision rather than an accident of the operator.
  it("is fresh exactly on the deadline and stale one hour later", () => {
    const onDeadline = hoursAgo(DAILY * STALE_AFTER_INTERVALS);
    expect(freshnessOf(onDeadline, DAILY, NOW).kind).toBe("fresh");

    const past = hoursAgo(DAILY * STALE_AFTER_INTERVALS + 1);
    expect(freshnessOf(past, DAILY, NOW)).toEqual({ kind: "stale", verifiedAt: past });
  });

  // The state §9.10 is written about: the last thing we heard was "no
  // difference", and we have heard nothing since. A screen with one badge shows
  // this norm as green.
  it("goes stale on a weekly norm three weeks after its last verification", () => {
    const verifiedAt = hoursAgo(24 * 7 * 3 + 1);
    expect(freshnessOf(verifiedAt, 24 * 7, NOW)).toEqual({ kind: "stale", verifiedAt });
  });

  it("keeps the same verification fresh under a slower cadence", () => {
    // Four days old: stale at a daily cadence, fresh at a weekly one. The
    // deadline is a function of the interval, not a fixed age.
    const verifiedAt = hoursAgo(24 * 4);
    expect(freshnessOf(verifiedAt, DAILY, NOW).kind).toBe("stale");
    expect(freshnessOf(verifiedAt, 24 * 7, NOW).kind).toBe("fresh");
  });

  describe("bad data renders as odd, never as a throw (DoD §5)", () => {
    it("treats an unparsable timestamp as never checked", () => {
      expect(freshnessOf("not a date", DAILY, NOW)).toEqual({ kind: "never_checked" });
    });

    // Deliberately fresh rather than stale: an alarm produced by arithmetic
    // nobody can explain is one that gets ignored, and takes the real ones with
    // it. The database refuses these intervals anyway.
    it("does not raise an alarm on an interval it cannot reason about", () => {
      const verifiedAt = hoursAgo(24 * 400);
      expect(freshnessOf(verifiedAt, 0, NOW).kind).toBe("fresh");
      expect(freshnessOf(verifiedAt, -5, NOW).kind).toBe("fresh");
      expect(freshnessOf(verifiedAt, Number.NaN, NOW).kind).toBe("fresh");
    });
  });
});
