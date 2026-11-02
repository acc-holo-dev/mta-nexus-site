"use client";

import type { ReactNode } from "react";

const defaultLabelClass = "flex items-start gap-3 text-sm";
export const actionConfirmCheckboxFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const defaultCheckboxClass = `mt-1 ${actionConfirmCheckboxFocusClass}`;

export type ActionConfirmCheckboxProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  required?: boolean;
  /** Label wrapper classes; defaults to the shared destructive-action confirm row. */
  labelClassName?: string;
  checkboxClassName?: string;
  describedBy?: string;
};

export function ActionConfirmCheckbox({
  id,
  checked,
  onCheckedChange,
  children,
  disabled,
  required,
  labelClassName = defaultLabelClass,
  checkboxClassName = defaultCheckboxClass,
  describedBy,
}: ActionConfirmCheckboxProps) {
  return (
    <label htmlFor={id} className={labelClassName}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        required={required}
        aria-describedby={describedBy}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className={checkboxClassName}
      />
      <span>{children}</span>
    </label>
  );
}
