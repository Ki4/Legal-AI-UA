import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Label } from "./Label";

export interface FormFieldProps {
  /** Also used to wire the label to the control via htmlFor/id. */
  htmlFor: string;
  label: string;
  /** Supporting line shown when there is no error. */
  hint?: string;
  /** Error text — rendered with an icon, never color alone. Sets aria-invalid upstream on the control. */
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ htmlFor, label, hint, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="mb-0">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-inkMute">{hint}</p>
      ) : null}
    </div>
  );
}
