import type { LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("mb-1.5 block text-[12.5px] font-semibold text-inkSoft", className)}
      {...props}
    />
  );
}
