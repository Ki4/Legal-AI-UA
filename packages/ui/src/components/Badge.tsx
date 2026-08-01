import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type BadgeTone = "ok" | "warn" | "danger" | "brand" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Small color dot before the label. */
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  // Text uses the AA-safe *-ink pair (design-system.md §1.3); tint backgrounds
  // and the dot below stay on the vivid tokens.
  ok: "bg-ok/10 text-ok-ink",
  warn: "bg-warn/10 text-warn-ink",
  danger: "bg-danger/10 text-danger-ink",
  brand: "bg-brand/10 text-brand",
  neutral: "bg-paperAlt text-inkSoft",
};

const dotClasses: Record<BadgeTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  brand: "bg-brand",
  neutral: "bg-inkMute",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
