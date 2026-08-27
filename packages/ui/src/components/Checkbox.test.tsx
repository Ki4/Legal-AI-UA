// Two things here are decided by markup and by nothing else, which is why they
// are asserted rather than looked at once.
//
// The first is the accessible name. `label` and `description` render inches
// apart and look right either way; nested inside the `<label>` the description
// silently becomes part of the control's name, and the person who finds out is
// the one hearing "personal data. Checking this requires a legal basis and a
// retention period, checkbox, not checked" on every arrow key.
//
// The second is `indeterminate`. It exists only as a DOM property — there is no
// attribute for it — so it is the one piece of this component's state that a
// rerender cannot express and an effect has to carry.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

// `@testing-library/jest-dom` is deliberately not a dependency of this
// workspace, so the description is checked the way the browser resolves it:
// follow `aria-describedby` to the element it names and read that.
function accessibleDescription(element: HTMLElement): string {
  const id = element.getAttribute("aria-describedby");
  if (id === null) return "";
  return element.ownerDocument.getElementById(id)?.textContent ?? "";
}

describe("Checkbox", () => {
  it("names itself with the label alone, and describes itself with the rest", () => {
    render(
      <Checkbox label="Personal data" description="Requires a basis and a retention period." />,
    );

    // The query itself is half the assertion: `name` matches the whole
    // accessible name, so a description folded into it fails right here.
    const box = screen.getByRole("checkbox", { name: "Personal data" });
    expect(accessibleDescription(box)).toBe("Requires a basis and a retention period.");
  });

  it("toggles from a click anywhere on the row, not only on the 18px box", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Required" onChange={onChange} />);
    const box = screen.getByRole<HTMLInputElement>("checkbox");

    // The label text, not the input. §12 asks for a 44px target, and the label
    // wrapping the control is what turns an 18px square into the whole row.
    fireEvent.click(screen.getByText("Required"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(box.checked).toBe(true);
  });

  it("carries `indeterminate` onto the node, and takes it off again", () => {
    const { rerender } = render(<Checkbox label="All fields" indeterminate />);
    const box = screen.getByRole<HTMLInputElement>("checkbox");
    expect(box.indeterminate).toBe(true);

    rerender(<Checkbox label="All fields" indeterminate={false} />);
    expect(box.indeterminate).toBe(false);
  });

  it("announces invalidity rather than only colouring the border", () => {
    render(<Checkbox label="Personal data" invalid />);

    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBe("true");
  });
});
