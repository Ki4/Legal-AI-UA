import { FileText, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

/** §9.10 — a muted icon, a warm one-line title, an optional supporting line,
 * an optional primary action. Never "No data". */
export function EmptyState({
  icon: Icon = FileText,
  title,
  hint,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <Icon size={28} className="text-inkMute" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {hint && <p className="text-sm text-inkSoft">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
