// What is asserted here is the bookkeeping between a React prop and a DOM
// element that has its own idea of whether it is open — and nothing about
// modality. The focus trap, the top layer and the inert background are the
// browser's, and under `jsdom-dialog.ts` they do not exist at all; a test
// claiming to prove them would be proving something about the shim. See that
// file for the line between the two.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

function open(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  const onClose = vi.fn();
  const result = render(
    <Dialog open onClose={onClose} title="Publish version 3" closeLabel="Close" {...props}>
      The body
    </Dialog>,
  );
  return { onClose, ...result };
}

describe("Dialog", () => {
  it("holds nothing while closed — not even last time's question", () => {
    const { rerender } = open();
    expect(screen.getByRole("heading", { name: "Publish version 3" })).toBeTruthy();

    rerender(
      <Dialog open={false} onClose={vi.fn()} title="Publish version 3" closeLabel="Close">
        The body
      </Dialog>,
    );

    expect(screen.queryByRole("heading", { name: "Publish version 3" })).toBeNull();
    expect(screen.queryByText("The body")).toBeNull();
  });

  it("opens the element itself, and is named by its own title", () => {
    const { container } = open();
    const element = container.querySelector("dialog");

    expect(element?.open).toBe(true);
    const labelledBy = element?.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy ?? "")?.textContent).toBe("Publish version 3");
  });

  it("reports a close the browser performed, not only one we asked for", async () => {
    const { container, onClose } = open();

    // Esc and a `method="dialog"` submit both arrive this way: the element is
    // already closed by the time anyone hears about it. Without the listener the
    // parent's `open` would stay true over an empty screen.
    container.querySelector("dialog")?.close();
    await Promise.resolve();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks to be closed when the close button is used", () => {
    const { onClose } = open();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drops the close button when the footer already holds the way out", () => {
    open({ hideCloseButton: true });

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("gives the page its scrolling back, exactly as it found it", () => {
    document.documentElement.style.overflow = "scroll";
    const { unmount } = open();
    expect(document.documentElement.style.overflow).toBe("hidden");

    unmount();

    expect(document.documentElement.style.overflow).toBe("scroll");
    document.documentElement.style.overflow = "";
  });
});
