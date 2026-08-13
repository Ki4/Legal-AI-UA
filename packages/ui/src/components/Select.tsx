import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { inputClasses } from "./Input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption[];
  /**
   * Shown as a disabled first entry when the value is empty — "Choose a
   * lawyer", not a silent blank. Omit it when the field always has a value.
   */
  placeholder?: string;
  /** Error state — pairs with FormField's error text, never color alone. */
  invalid?: boolean;
}

/**
 * A native `<select>`, deliberately.
 *
 * A custom listbox is the more fashionable answer and the wrong one here, for
 * three reasons that are not preference:
 *
 * 1. **The primary user.** §12 asks for 44×44 targets and calm, familiar
 *    controls for a non-technical lawyer who may be older and on a mouse. The
 *    control the operating system already taught them beats one we teach them.
 * 2. **Accessibility arrives finished.** Keyboard navigation, typeahead, screen
 *    reader semantics and the mobile picker are native behaviour. Rebuilt by
 *    hand they are a focus trap, `aria-activedescendant`, and a list of bugs
 *    found by the people least able to work around them.
 * 3. **It does not pre-empt a decision.** Popover infrastructure is its own
 *    wave-1 item, and a custom select needs it. Building the popover here, as a
 *    side effect of needing a dropdown, is how a shared primitive ends up
 *    shaped by the first screen that wanted one.
 *
 * When a select needs what a native one cannot do — option groups with icons,
 * async search, multi-select — that is a `Combobox`, a different component with
 * a different name, built on the popover once it exists. It is not this one
 * growing a `custom` prop.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid = false, className, value, ...props },
  ref,
) {
  return (
    // The wrapper exists for the chevron: a native select's own arrow cannot be
    // styled across browsers, so it is switched off and drawn in tokens.
    <div className="relative">
      <select
        ref={ref}
        value={value}
        aria-invalid={invalid || undefined}
        className={cn(
          inputClasses,
          // `appearance-none` removes the platform arrow; the right padding is
          // what keeps a long option from running underneath ours.
          "min-h-[44px] cursor-pointer appearance-none pr-10",
          // A placeholder still selected is muted, so an unanswered field reads
          // as unanswered rather than as an answer somebody chose.
          value === "" && placeholder !== undefined && "text-inkMute",
          invalid && "border-danger",
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && (
          // Disabled rather than selectable: choosing "Choose a lawyer" is not a
          // choice. Kept in the list so the field can render its own emptiness.
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-inkMute"
      />
    </div>
  );
});
