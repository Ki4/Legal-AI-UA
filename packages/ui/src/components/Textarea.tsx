import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { inputClasses } from "./Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state — pairs with FormField's error text, never color alone. */
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, "min-h-[62px] resize-y", invalid && "border-danger", className)}
      {...props}
    />
  );
});
