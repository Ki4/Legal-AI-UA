import type { HTMLAttributes, TdHTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** §9.8 — the lawyer's most-used screen. A thin styled layer over native
 * table elements: composable, typed, no table library. */
export type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", className)} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export type TableHeadProps = HTMLAttributes<HTMLTableSectionElement>;

/** Section-label typography, sticky within the scroll container. Nest plain
 * <tr>/<th> children — styling reaches them via the child selector below. */
export function TableHead({ className, children, ...props }: TableHeadProps) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-[var(--z-sticky)] bg-paperAlt text-left",
        "[&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[13px] [&_th]:font-semibold",
        "[&_th]:uppercase [&_th]:tracking-[0.07em] [&_th]:text-inkMute",
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** bg-brand/5 tint + 2px left brand border. */
  selected?: boolean;
}

export function TableRow({ selected = false, className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        "h-12 border-b border-line last:border-b-0",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        "hover:bg-paperAlt",
        selected && "border-l-2 border-l-brand bg-brand/5",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export type TableCellAlign = "left" | "num" | "center";

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  /** left (default text), num (right + tabular-nums), center (status). */
  align?: TableCellAlign;
}

const alignClasses: Record<TableCellAlign, string> = {
  left: "text-left",
  num: "text-right tabular-nums",
  center: "text-center",
};

export function TableCell({ align = "left", className, children, ...props }: TableCellProps) {
  return (
    <td className={cn("px-4 py-2.5 text-ink", alignClasses[align], className)} {...props}>
      {children}
    </td>
  );
}
