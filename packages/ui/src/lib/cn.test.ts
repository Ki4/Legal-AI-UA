import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins fragments with a single space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops the falsy values a conditional class produces", () => {
    // The reason this helper exists: `cond && "class"` yields false, and
    // `cond ? "class" : undefined` yields undefined. Neither may reach the DOM.
    expect(cn("base", false, null, undefined, "active")).toBe("base active");
  });

  it("drops an empty string rather than emitting a double space", () => {
    expect(cn("a", "", "b")).toBe("a b");
  });

  it("returns an empty string when everything is falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
