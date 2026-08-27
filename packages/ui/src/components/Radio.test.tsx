// A radio group's semantics are the whole of it. Rendered as a bold paragraph
// over a stack of inputs it looks finished and announces nothing — the person
// hears six unrelated options and never the question they answer. `fieldset`
// and `legend` are what make the six one control, and only a role query says
// whether they are doing it.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup, type RadioOption } from "./Radio";

const bases: readonly RadioOption[] = [
  { value: "consent", label: "Consent", description: "The client agreed, and may withdraw." },
  { value: "contract", label: "Contract" },
  { value: "legal_obligation", label: "Legal obligation", disabled: true },
];

describe("RadioGroup", () => {
  it("is one group carrying the question, not three loose inputs", () => {
    render(
      <RadioGroup
        name="legal_basis"
        legend="Legal basis"
        options={bases}
        value={null}
        onValueChange={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Legal basis" });
    expect(group.querySelectorAll("input[type='radio']")).toHaveLength(3);
  });

  it("reports the value chosen, and shows nothing chosen until one is", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        name="legal_basis"
        legend="Legal basis"
        options={bases}
        value={null}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Contract" }));

    expect(onValueChange).toHaveBeenCalledWith("contract");
  });

  it("disables one option without disabling the group", () => {
    render(
      <RadioGroup
        name="legal_basis"
        legend="Legal basis"
        options={bases}
        value="contract"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Legal obligation" }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Contract" }).disabled).toBe(false);
  });

  it("marks the group invalid, not one radio, and says why in words", () => {
    render(
      <RadioGroup
        name="legal_basis"
        legend="Legal basis"
        options={bases}
        value={null}
        onValueChange={vi.fn()}
        error="Personal data needs a basis."
      />,
    );

    const group = screen.getByRole("group", { name: "Legal basis" });
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Personal data needs a basis.")).toBeTruthy();
  });
});
