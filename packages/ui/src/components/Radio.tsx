import { AlertCircle } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  /** Second line under the label — where the difference between two options lives. */
  description?: ReactNode;
}

const dotClasses = cn(
  "peer h-[18px] w-[18px] shrink-0 appearance-none rounded-full border border-lineStrong bg-paper",
  "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]",
  "checked:border-brand checked:border-[5.5px]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  "disabled:opacity-50",
);

/**
 * One option. Native, for the reasons in `Select`, and with one behaviour a
 * checkbox does not have: arrow keys move between the radios sharing a `name`,
 * and only the checked one is a tab stop. That is roving focus, it is a common
 * thing to rebuild badly, and here it is simply what the browser does.
 *
 * Usually reached through `RadioGroup` rather than directly — a lone radio
 * outside a group with a name is a checkbox that cannot be unchecked.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, className, disabled, ...props },
  ref,
) {
  const descriptionId = useId();

  return (
    <div className={cn("min-w-0", className)}>
      <label
        className={cn(
          "flex min-h-[44px] cursor-pointer items-center gap-3 py-[13px]",
          disabled && "cursor-not-allowed",
        )}
      >
        {/* The filled dot is drawn by growing the border inward on `checked`
            rather than by an inner element. One box, one state, nothing to keep
            in step. */}
        <input
          ref={ref}
          type="radio"
          disabled={disabled}
          aria-describedby={description !== undefined ? descriptionId : undefined}
          className={dotClasses}
          {...props}
        />
        <span className={cn("min-w-0 text-sm text-ink", disabled && "opacity-50")}>{label}</span>
      </label>
      {/* Outside the label, like Checkbox's: nested, it would be read as part of
          the option's name every time focus moved between the radios. */}
      {description !== undefined && (
        <p
          id={descriptionId}
          className={cn("-mt-2 pb-2 pl-[30px] text-xs text-inkMute", disabled && "opacity-50")}
        >
          {description}
        </p>
      )}
    </div>
  );
});

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Shared by every radio in the group. This is what makes them one control. */
  name: string;
  /** The group's question. Rendered as the fieldset's legend. */
  legend: ReactNode;
  /** Same shape as `SelectProps.options`, so a set of choices can move between the two. */
  options: readonly RadioOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  /** Supporting line under the legend, shown when there is no error. */
  hint?: ReactNode;
  /** Error text — rendered under the group, and it is the group that is invalid, not one radio. */
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A `fieldset` with a `legend`, because a radio group is one control with one
 * question and a screen reader has to be told so. Wrapping the options in a
 * `div` with a bold paragraph above looks the same and announces nothing.
 *
 * Prefer this over `Select` when the options differ in a way the person must
 * read to choose — a description per option is the tell. Six GDPR bases with a
 * sentence each is a radio group; six countries is a select.
 */
export function RadioGroup({
  name,
  legend,
  options,
  value,
  onValueChange,
  hint,
  error,
  disabled = false,
  className,
}: RadioGroupProps) {
  const describedBy = useId();

  return (
    <fieldset
      disabled={disabled}
      aria-invalid={error !== undefined || undefined}
      aria-describedby={hint !== undefined || error !== undefined ? describedBy : undefined}
      className={cn("min-w-0", className)}
    >
      <legend className="mb-1.5 block text-[12.5px] font-semibold text-inkSoft">{legend}</legend>
      <div className="divide-y divide-line">
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            label={option.label}
            description={option.description}
            onChange={() => onValueChange(option.value)}
          />
        ))}
      </div>
      {error !== undefined ? (
        // Icon and text, never colour alone — the same pairing FormField makes,
        // for the same reason: a red line is invisible to the reader who most
        // needs it.
        <p id={describedBy} className="mt-1.5 flex items-center gap-1 text-xs text-danger-ink">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={describedBy} className="mt-1.5 text-xs text-inkMute">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
