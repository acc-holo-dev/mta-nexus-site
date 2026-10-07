import * as React from "react";
import { cn } from "./utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const base =
      "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

    const variants = {
      primary:
        "bg-accent text-white shadow-nexus-sm hover:bg-[var(--nexus-accent-hover)]",
      secondary:
        "border border-base bg-inset text-primary hover:bg-hover",
      outline:
        "border border-base bg-surface text-secondary hover:border-strong hover:bg-hover hover:text-primary",
      ghost: "text-secondary hover:bg-hover hover:text-primary",
      danger:
        "bg-danger-solid text-white shadow-nexus-sm hover:opacity-90",
    };

    const sizes = {
      sm: "h-8 gap-1.5 px-3 text-xs",
      md: "h-10 gap-2 px-4 text-sm",
      lg: "h-12 gap-2.5 px-6 text-base",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden="true"
            className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
