import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, label, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          id={id}
          type={type}
          ref={ref}
          className={cn(
            "w-full h-10 px-3 py-2 bg-neutral-900 border rounded-lg text-sm text-neutral-100 placeholder-neutral-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors",
            error ? "border-red-500 focus:ring-red-500" : "border-neutral-700",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
