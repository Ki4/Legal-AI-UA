import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Error state — pairs with FormField's error text, never color alone. */
  invalid?: boolean;
}

export const inputClasses = cn(
  "w-full rounded-btn border border-lineStrong bg-paper px-3.5 py-[11px] text-sm text-ink",
  "placeholder:text-inkMute",
  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15",
  "disabled:opacity-50",
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, invalid && "border-danger", className)}
      {...props}
    />
  );
});
