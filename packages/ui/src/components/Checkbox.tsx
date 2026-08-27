import { Check, Minus } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> {
  /**
   * The checkbox carries its own label rather than sitting inside a FormField.
   * A checkbox's question is answered *by* its label ("this field holds personal
   * data") — put that above the control and the sentence reads twice.
   */
  label: ReactNode;
  /** Second line: what checking it commits the person to. */
  description?: ReactNode;
  /**
   * Neither checked nor unchecked. Not a third value — a summary of children
   * that disagree. It cannot be expressed in markup, only assigned to the DOM
   * node, which is exactly why it belongs here and not in a screen holding a
   * ref for one line.
   */
  indeterminate?: boolean;
  /** Error state — pairs with the error text nearby, never color alone. */
  invalid?: boolean;
}

const boxClasses = cn(
  "peer h-[18px] w-[18px] shrink-0 appearance-none rounded-[5px] border border-lineStrong bg-paper",
  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  "disabled:opacity-50",
);

/**
 * A native `<input type="checkbox">` with the platform box switched off and
 * ours drawn in tokens — the same bargain as `Select`. What is restyled here is
 * the paint; the control underneath is still the browser's, so the space bar,
 * the label's click target, form participation and the screen reader's
 * "checkbox, checked" arrive finished rather than rebuilt.
 *
 * **Not a `Switch`.** A checkbox is a value a form saves later; a switch takes
 * effect the moment it moves. `required` on a questionnaire field is a
 * checkbox, because nothing happens until Save.
 *
 * The description sits outside the `<label>` on purpose. Nested, it becomes
 * part of the control's accessible *name*, and a screen reader announces the
 * whole paragraph every time focus lands — `aria-describedby` is how a second
 * sentence stays a second sentence.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, invalid = false, className, disabled, ...props },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const descriptionId = useId();

  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cn("min-w-0", className)}>
      {/* `min-h-[44px]` and the label wrapping the control are together the §12
          target size: the whole row is clickable, not an 18px square. */}
      <label
        className={cn(
          "flex min-h-[44px] cursor-pointer items-center gap-3 py-[13px]",
          disabled && "cursor-not-allowed",
        )}
      >
        <span className="relative inline-flex shrink-0 items-center">
          <input
            ref={(node) => {
              inner.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            type="checkbox"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={description !== undefined ? descriptionId : undefined}
            className={cn(boxClasses, invalid && "border-danger")}
            {...props}
          />
          {/* Drawn over the box rather than as a background image, so the mark is
              an icon from the same set as every other glyph in the system. Which
              one shows is decided by the input's own state through `peer-*`, so
              it cannot drift out of step with what the control holds. */}
          <Check
            size={13}
            strokeWidth={3}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-[2.5px] text-white opacity-0",
              "peer-checked:opacity-100 peer-indeterminate:opacity-0",
            )}
          />
          <Minus
            size={13}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none absolute left-[2.5px] text-white opacity-0 peer-indeterminate:opacity-100"
          />
        </span>
        <span className={cn("min-w-0 text-sm text-ink", disabled && "opacity-50")}>{label}</span>
      </label>
      {description !== undefined && (
        <p
          id={descriptionId}
          className={cn("-mt-2 pb-2 pl-[30px] text-xs text-inkMute", disabled && "opacity-50")}
        >
          {description}
        </p>
      )}
    </div>
  );
});
