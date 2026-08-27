import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Spinner replaces the leading position, label stays, button is disabled. */
  loading?: boolean;
}

const base = cn(
  "inline-flex items-center justify-center gap-2 rounded-btn px-[18px] py-2.5 text-sm font-medium",
  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  "active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
);

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-onBrand shadow-card hover:bg-brand/90",
  secondary: "bg-paper text-ink border border-lineStrong hover:bg-paperAlt",
  ghost: "bg-transparent text-brand hover:bg-brand/10",
  danger: "bg-paper text-danger-ink border border-danger/30 hover:bg-danger/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variantClasses[variant], className)}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
