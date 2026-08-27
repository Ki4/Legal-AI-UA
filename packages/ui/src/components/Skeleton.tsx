import { cn } from "../lib/cn";

export interface SkeletonProps {
  /** How many placeholder rows. One block reads as a bug; a few read as a list arriving. */
  rows?: number;
  /** Height of each row, as a Tailwind class from the spacing scale. */
  rowClassName?: string;
  /**
   * What a screen reader is told while this is on screen. Required, and there is
   * no default: a skeleton is invisible to somebody who cannot see it, and a
   * silent one is a screen that simply says nothing for as long as the request
   * takes.
   */
  label: string;
  className?: string;
}

/**
 * The shape of what is coming, held while it comes.
 *
 * Preferred over a spinner where the eventual content has a shape worth
 * reserving — a list, a table, a card. The reason is not decoration: a spinner
 * that resolves into a list moves everything on the page at the moment it
 * lands, and the person reading has to find their place again.
 *
 * The animation is `animate-pulse`, which the reduced-motion floor in
 * `tokens.css` already collapses for anybody who asked the OS for less movement
 * — so this component names no duration of its own.
 */
export function Skeleton({ rows = 3, rowClassName = "h-16", label, className }: SkeletonProps) {
  return (
    <div
      // One live region for the whole block rather than one per row: `polite`
      // announces once, where per-row regions would announce the same sentence
      // three times.
      role="status"
      aria-live="polite"
      className={cn("grid gap-3", className)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn("animate-pulse rounded-card border border-line bg-paperAlt", rowClassName)}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
