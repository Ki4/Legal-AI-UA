// `useConfirm` turns a dialog into an `await`, and everything that can go wrong
// with it goes wrong the same way: a promise that never settles. The caller
// after the `await` simply never runs — no error, no log, a row that was not
// deleted and no sign that anything was asked. So every ending a question can
// have is asserted to produce an answer, including the two nobody writes on
// purpose: the component going away mid-question, and a second question asked
// while the first is still on screen.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useConfirm, type ConfirmRequest } from "./ConfirmModal";

const request: ConfirmRequest = {
  title: "Delete the field?",
  description: "The template still references it.",
  confirmLabel: "Delete field",
  cancelLabel: "Keep it",
  tone: "danger",
};

function Harness({ onAnswer }: { onAnswer: (answer: boolean) => void }) {
  const { confirm, confirmation } = useConfirm();

  return (
    <>
      <button
        onClick={() => {
          void confirm(request).then(onAnswer);
        }}
      >
        Ask
      </button>
      {confirmation}
    </>
  );
}

describe("useConfirm", () => {
  it("answers true only when the named action is chosen", async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    // The confirm button names the action rather than agreeing with the dialog —
    // "Delete field", never "OK". Querying by that name is what holds the rule.
    fireEvent.click(screen.getByRole("button", { name: "Delete field" }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
  });

  it("answers false when cancelled, and takes the question off screen", async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("heading", { name: "Delete the field?" })).toBeNull();
  });

  it("answers false when the screen goes away with the question still open", async () => {
    const onAnswer = vi.fn();
    const { unmount } = render(<Harness onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("heading", { name: "Delete the field?" })).toBeTruthy();

    unmount();

    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it("refuses a second question rather than stranding the first", async () => {
    const onAnswer = vi.fn();
    render(<Harness onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    // The newcomer is answered immediately and never appears; the question
    // already on screen is untouched and still waiting.
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByRole("heading", { name: "Delete the field?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete field" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });
});
