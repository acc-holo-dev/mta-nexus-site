import * as React from "react";
import { cn } from "./utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-label uppercase text-secondary"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            "h-10 w-full rounded-lg border bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]",
            error
              ? "border-[color:var(--nexus-danger)]"
              : "border-base hover:border-strong",
            className,
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-xs text-danger"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
