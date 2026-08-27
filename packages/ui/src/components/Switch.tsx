import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "role" | "children"
> {
  label: ReactNode;
  /** Second line: what turning it on starts doing, in the present tense. */
  description?: ReactNode;
}

const trackClasses = cn(
  "peer h-6 w-[42px] shrink-0 cursor-pointer appearance-none rounded-full border border-lineStrong bg-line",
  "transition-colors duration-[var(--motion-base)] ease-[var(--ease-out)]",
  "checked:border-brand checked:bg-brand",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * A native checkbox wearing `role="switch"`, which is the one place this system
 * overrides a native role on purpose: the element's behaviour — two states, the
 * space bar, form participation — is exactly a checkbox's, and only the word
 * announced differs. "Switch, on" tells the person the change has happened;
 * "checkbox, checked" tells them it has been noted for later.
 *
 * **That sentence is the whole rule for choosing between the two.** A switch
 * takes effect when it moves and needs no Save — pausing a published service,
 * turning a notification on. A value a form writes on submit is a `Checkbox`.
 * A switch with a Save button beside it is a checkbox that has been mislabelled,
 * and the person will believe the change landed before it did.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, className, disabled, ...props },
  ref,
) {
  const descriptionId = useId();

  return (
    <div className={cn("min-w-0", className)}>
      <label
        className={cn(
          "flex min-h-[44px] cursor-pointer items-center gap-3 py-2.5",
          disabled && "cursor-not-allowed",
        )}
      >
        <span className="relative inline-flex shrink-0 items-center">
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            disabled={disabled}
            aria-describedby={description !== undefined ? descriptionId : undefined}
            className={trackClasses}
            {...props}
          />
          {/* The thumb travels with a transform rather than by changing `left`,
              so the movement is composited and does not lay the row out again on
              every frame. `peer-checked` reads the input's real state — there is
              no second copy of "on" to fall out of step. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-[3px] h-[18px] w-[18px] rounded-full bg-paper shadow-card",
              "transition-transform duration-[var(--motion-base)] ease-[var(--ease-out)]",
              "peer-checked:translate-x-[18px]",
            )}
          />
        </span>
        <span className={cn("min-w-0 text-sm text-ink", disabled && "opacity-50")}>{label}</span>
      </label>
      {description !== undefined && (
        <p
          id={descriptionId}
          className={cn("-mt-1.5 pb-2 pl-[54px] text-xs text-inkMute", disabled && "opacity-50")}
        >
          {description}
        </p>
      )}
    </div>
  );
});
