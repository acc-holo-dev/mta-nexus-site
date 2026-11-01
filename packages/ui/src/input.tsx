import * as React from "react";
import { fieldControlClass, type FieldSize } from "./field-classes";
import { cn } from "./utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  error?: string;
  label?: string;
  hint?: string;
  /** Visible reason when the control is disabled (not hover-only). */
  disabledReason?: string;
  pending?: boolean;
  size?: FieldSize;
}

function useFieldIds(id: string | undefined) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  return {
    fieldId,
    hintId: `${fieldId}-hint`,
    errorId: `${fieldId}-error`,
    disabledId: `${fieldId}-disabled`,
  };
}

function joinDescribedBy(...parts: Array<string | undefined>) {
  const value = parts.filter(Boolean).join(" ");
  return value || undefined;
}

export interface FieldProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabledReason?: string;
  pending?: boolean;
  size?: FieldSize;
  className?: string;
  children: (control: {
    id: string;
    describedBy?: string;
    invalid?: boolean;
    pending?: boolean;
    size: FieldSize;
    className: string;
  }) => React.ReactNode;
}

/** Shared label/hint/error chrome for input, select, and textarea. */
export function Field({
  id,
  label,
  hint,
  error,
  disabledReason,
  pending = false,
  size = "md",
  className,
  children,
}: FieldProps) {
  const { fieldId, hintId, errorId, disabledId } = useFieldIds(id);
  const describedBy = joinDescribedBy(
    hint && !error ? hintId : undefined,
    error ? errorId : undefined,
    disabledReason ? disabledId : undefined,
  );

  return (
    <div className={cn("w-full space-y-1.5", className)} aria-busy={pending || undefined}>
      {label && (
        <label htmlFor={fieldId} className="block font-label uppercase text-secondary">
          {label}
        </label>
      )}
      {children({
        id: fieldId,
        describedBy,
        invalid: error ? true : undefined,
        pending,
        size,
        className: fieldControlClass({
          size,
          error: Boolean(error),
          pending,
        }),
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {disabledReason && (
        <p id={disabledId} className="text-xs text-muted">
          {disabledReason}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      error,
      label,
      hint,
      disabledReason,
      pending = false,
      size = "md",
      id,
      disabled,
      readOnly,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const { fieldId, hintId, errorId, disabledId } = useFieldIds(id);
    const showDisabledReason = Boolean(disabled && disabledReason);
    const describedBy = joinDescribedBy(
      ariaDescribedBy,
      hint && !error ? hintId : undefined,
      error ? errorId : undefined,
      showDisabledReason ? disabledId : undefined,
    );

    return (
      <div className="w-full space-y-1.5" aria-busy={pending || undefined}>
        {label && (
          <label htmlFor={fieldId} className="block font-label uppercase text-secondary">
            {label}
          </label>
        )}
        <input
          id={fieldId}
          type={type}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          aria-busy={pending || undefined}
          className={fieldControlClass({
            size,
            error: Boolean(error),
            pending,
            readOnly: Boolean(readOnly),
            disabled: Boolean(disabled),
            className,
          })}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {showDisabledReason && (
          <p id={disabledId} className="text-xs text-muted">
            {disabledReason}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
