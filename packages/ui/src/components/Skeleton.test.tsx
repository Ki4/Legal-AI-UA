// A skeleton is the one loading state that is invisible to the people most
// likely to need telling. Both assertions below are about that: the placeholder
// bars are hidden from the accessibility tree, and the sentence that replaces
// them is not.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("announces the wait once, not once per row", () => {
    render(<Skeleton rows={4} label="Loading the team" />);

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Loading the team");
  });

  it("hides the bars themselves, which mean nothing read aloud", () => {
    const { container } = render(<Skeleton rows={3} label="Loading" />);

    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
  });

  it("reserves the number of rows it was asked for", () => {
    const { container } = render(<Skeleton rows={5} label="Loading" />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });
});
