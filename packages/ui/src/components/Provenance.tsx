import { BadgeCheck, Pencil, Sparkles, type LucideIcon } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type ProvenanceState = "ai" | "confirmed" | "edited";

export interface ProvenanceProps extends HTMLAttributes<HTMLSpanElement> {
  state: ProvenanceState;
  /** Overrides the default copy for the state. */
  label?: string;
}

const defaultLabel: Record<ProvenanceState, string> = {
  ai: "AI suggested",
  confirmed: "Confirmed by lawyer",
  edited: "Edited by lawyer",
};

const icon: Record<ProvenanceState, LucideIcon> = {
  ai: Sparkles,
  confirmed: BadgeCheck,
  edited: Pencil,
};

// §8.1 — a block awaiting review carries "ai"; once the lawyer approves it
// flips to "confirmed". "ai"/"confirmed" get a tint + left-border accent
// (dashed for AI, solid once human-confirmed); "edited" stays quiet, no tint.
const stateClasses: Record<ProvenanceState, string> = {
  ai: "rounded-l-none border-l-2 border-dashed border-brand/40 bg-brand/8 text-brand",
  confirmed: "rounded-l-none border-l-2 border-solid border-ok/40 bg-ok/8 text-ok-ink",
  edited: "text-inkSoft",
};

export function Provenance({ state, label, className, ...props }: ProvenanceProps) {
  const Icon = icon[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
        "transition-colors duration-[var(--motion-base)] ease-[var(--ease-out)]",
        stateClasses[state],
        className,
      )}
      {...props}
    >
      <Icon size={14} aria-hidden="true" />
      {label ?? defaultLabel[state]}
    </span>
  );
}
