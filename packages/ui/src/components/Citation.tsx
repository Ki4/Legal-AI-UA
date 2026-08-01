import { Quote } from "lucide-react";
import { cn } from "../lib/cn";

export interface CitationProps {
  /** e.g. "art. 180 FC". A missing source is the CALLER's bug — this
   * component renders no empty state for it. */
  source: string;
  href?: string;
  className?: string;
}

const chipClasses = cn(
  "inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-brand/10 px-2 py-0.5",
  "font-mono text-xs text-brand",
  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
);

/** §8.3 — source of every extracted fact. The full popover (exact quoted
 * passage + link to the source document/article node) arrives with the
 * Popover primitive; for now the `title` attribute surfaces the source text
 * on hover as a plain-HTML stand-in. */
export function Citation({ source, href, className }: CitationProps) {
  if (href) {
    return (
      <a href={href} title={source} className={cn(chipClasses, "hover:underline", className)}>
        <Quote size={12} aria-hidden="true" />
        {source}
      </a>
    );
  }

  return (
    <span title={source} className={cn(chipClasses, className)}>
      <Quote size={12} aria-hidden="true" />
      {source}
    </span>
  );
}
