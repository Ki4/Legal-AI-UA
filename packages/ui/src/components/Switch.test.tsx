// A switch is a checkbox that claims to have already done the thing. The claim
// lives entirely in `role="switch"`, so it is the one property worth holding: a
// regression that dropped it would leave a control that looks identical, works
// identically, and tells a screen reader the change is merely noted for later.

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Switch } from "./Switch";

// `@testing-library/jest-dom` is deliberately not a dependency of this
// workspace, so the description is checked the way the browser resolves it:
// follow `aria-describedby` to the element it names and read that.
function accessibleDescription(element: HTMLElement): string {
  const id = element.getAttribute("aria-describedby");
  if (id === null) return "";
  return element.ownerDocument.getElementById(id)?.textContent ?? "";
}

describe("Switch", () => {
  it("is announced as a switch, named by its label alone", () => {
    render(<Switch label="Pause the service" description="Takes it off sale immediately." />);

    const control = screen.getByRole("switch", { name: "Pause the service" });
    expect(accessibleDescription(control)).toBe("Takes it off sale immediately.");
  });

  it("moves when the row is clicked, and stays where the state puts it", () => {
    // Driven by real state rather than by a spy. A controlled checkbox is the
    // one shape where asserting on the event alone can pass while the control
    // snaps back: React rewrites the DOM from `checked` immediately afterwards,
    // so what the person sees is decided by the parent, not by the click.
    function Harness() {
      const [paused, setPaused] = useState(false);
      return (
        <Switch
          label="Pause the service"
          checked={paused}
          onChange={(event) => setPaused(event.target.checked)}
        />
      );
    }

    render(<Harness />);
    const control = screen.getByRole<HTMLInputElement>("switch");
    expect(control.checked).toBe(false);

    fireEvent.click(screen.getByText("Pause the service"));

    expect(control.checked).toBe(true);
  });
});
