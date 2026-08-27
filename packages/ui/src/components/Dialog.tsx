import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";

export type DialogWidth = "sm" | "md" | "lg";

export interface DialogProps {
  open: boolean;
  /**
   * Called for every way the dialog can leave the screen — Esc, the close
   * button, the browser closing it. The parent owns `open`; this only reports.
   */
  onClose: () => void;
  /** The dialog's heading, and what a screen reader announces on open. */
  title: ReactNode;
  /** Supporting line under the title. Kept out of `children` so it is announced with the title. */
  description?: ReactNode;
  /** Actions row, pinned under the content. Buttons, right-aligned. */
  footer?: ReactNode;
  /** Accessible name for the close button — a prop, never a string in here (see the note below). */
  closeLabel: string;
  /**
   * Hides the close button. For a dialog whose only exits are its own actions —
   * a confirmation with Cancel already in the footer does not need a second one.
   */
  hideCloseButton?: boolean;
  width?: DialogWidth;
  children?: ReactNode;
  className?: string;
}

const widthClasses: Record<DialogWidth, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
};

/**
 * A native `<dialog>` opened with `showModal()`, which is the same bargain
 * `Select` makes and pays off larger here. Focus moves in and is trapped, Esc
 * closes, everything behind goes inert, and the element sits in the top layer
 * where no `z-index` in the app can land on top of it. Hand-built modals get
 * that list wrong in a way that is invisible to the person building them and
 * total for the person using a keyboard or a screen reader.
 *
 * Two deliberate omissions:
 *
 * - **A click on the backdrop does not close it.** The interesting dialogs in
 *   this console ask a question with consequences — publish, pause, delete a
 *   field. A stray click is not an answer to one, and "it vanished, did it do
 *   it?" is the state we are avoiding. Esc and Cancel are the exits.
 * - **No default copy.** `closeLabel` is required and there is no English
 *   fallback, because a default would ship a screen with an untranslated word
 *   in it and nothing would fail. Every string a person reads comes from the
 *   caller's dictionary — the console's own rule, enforced here by absence.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  closeLabel,
  hideCloseButton = false,
  width = "md",
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // `open` is the prop; `el.open` is the DOM's own state. They are compared
  // rather than blindly assigned, because calling `showModal()` on a dialog
  // that is already modal throws, and `close()` on a closed one fires a second
  // `close` event — which would call `onClose` for a dialog nobody closed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // The browser can close a dialog without us: Esc, and a form submit with
  // `method="dialog"`. Listening to the element's own event is what keeps the
  // parent's `open` from drifting out of step with what is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  // A modal dialog makes the page inert but does not stop it scrolling behind
  // the backdrop. Restored to whatever was there rather than to "", so two
  // dialogs open in sequence cannot leave the page permanently unscrollable.
  useEffect(() => {
    if (!open) return;
    const { style } = document.documentElement;
    const previous = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      className={cn(
        // A `<dialog>` arrives with the user-agent's own margin, padding, border
        // and `max-width`. All four are replaced here rather than nudged.
        "m-auto w-[calc(100vw-2rem)] rounded-card border border-line bg-paper p-0 text-ink shadow-card",
        "backdrop:bg-ink/40",
        widthClasses[width],
        className,
      )}
    >
      {/* Content lives only while the dialog does. A closed dialog holding the
          previous answer is how a confirmation ends up showing the name of the
          thing that was deleted a minute ago. */}
      {open && (
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div className="flex items-start gap-4 px-6 pt-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {title}
              </h2>
              {description !== undefined && (
                <p id={descriptionId} className="mt-1 text-sm text-inkSoft">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <IconButton
                aria-label={closeLabel}
                onClick={onClose}
                icon={<X size={16} aria-hidden="true" />}
                className="-mr-2 -mt-1"
              />
            )}
          </div>
          {children !== undefined && (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-sm text-ink">
              {children}
            </div>
          )}
          {footer !== undefined && (
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
