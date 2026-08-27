import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export type ConfirmTone = "default" | "danger";

export interface ConfirmModalProps {
  open: boolean;
  title: ReactNode;
  /** What the action does and what it cannot undo. This is the sentence people actually read. */
  description?: ReactNode;
  /** Names the action, never "OK" — "Delete field" answers the question, "OK" answers nothing. */
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` for anything that destroys or takes something off sale. */
  tone?: ConfirmTone;
  /** The confirm button spins and both buttons lock while the action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The question a destructive action asks before it happens.
 *
 * Cancel is the first tab stop and carries the visual weight of the safe
 * choice; the confirm button names the action rather than agreeing with the
 * dialog. There is no close button — Cancel is already the way out, and two
 * controls that mean the same thing make a person decide which one is safer.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      width="sm"
      hideCloseButton
      // Unreachable — `hideCloseButton` is set — but the prop is required, and
      // required is what stops the next dialog from shipping an English word.
      closeLabel={cancelLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export interface ConfirmRequest {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
}

export interface UseConfirmResult {
  /** Resolves `true` if the person confirmed, `false` for every other ending. */
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  /** Render this once, anywhere in the component. It is the modal. */
  confirmation: ReactElement;
}

/**
 * `window.confirm()` with the platform's blocking dialog swapped for ours.
 *
 *     const { confirm, confirmation } = useConfirm();
 *     if (await confirm({ title: t("fields.delete.title"), ... })) remove(id);
 *     return <>{...}{confirmation}</>;
 *
 * The promise exists so the decision reads where the action is written, instead
 * of being cut in half — a handler that opens a modal, a piece of state holding
 * which row it was about, and a second handler that finishes the job somewhere
 * further down the file. That split is where "delete" ends up pointed at the
 * wrong row.
 *
 * Every ending resolves the promise exactly once: confirmed, cancelled, Esc,
 * and unmount. A promise that never settles is an `await` that never returns,
 * and the caller after it simply stops existing — silently, which is the worst
 * available way for a screen to fail.
 */
export function useConfirm(): UseConfirmResult {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  // Unmounting while a question is on screen is an answer of "no", not silence.
  // The ref is read at cleanup rather than captured, so this runs once, on the
  // way out, with whatever is actually pending.
  useEffect(() => {
    return () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const confirm = useCallback((next: ConfirmRequest) => {
    // A second question while one is open would strand the first promise. The
    // one already asked wins; the newcomer is answered "no" without appearing,
    // which is the outcome that cannot act on something nobody agreed to.
    if (resolveRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const confirmation = (
    <ConfirmModal
      open={request !== null}
      // Held after the answer only for the frame the dialog takes to leave —
      // `open` is already false, so nothing of the old question is on screen.
      title={request?.title ?? ""}
      description={request?.description}
      confirmLabel={request?.confirmLabel ?? ""}
      cancelLabel={request?.cancelLabel ?? ""}
      tone={request?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmation };
}
