import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** Required — an icon-only control must announce its purpose. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, disabled, className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-btn border border-lineStrong bg-paper text-inkSoft",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "hover:bg-paperAlt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
