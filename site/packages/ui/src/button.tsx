import * as React from "react";
import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
/** `sm` is compact desktop; `touch` targets ~44px; `hero` is the declared home CTA geometry. */
export type ButtonSize = "sm" | "md" | "lg" | "touch" | "icon" | "hero";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const base =
  "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-nexus-sm hover:bg-[var(--nexus-accent-hover)]",
  secondary: "border border-base bg-inset text-primary hover:bg-hover",
  outline:
    "border border-base bg-surface text-secondary hover:border-strong hover:bg-hover hover:text-primary",
  ghost: "text-secondary hover:bg-hover hover:text-primary",
  danger: "bg-danger-solid text-white shadow-nexus-sm hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2.5 px-6 text-base",
  touch: "h-11 min-h-11 gap-2 px-4 text-sm",
  icon: "h-10 w-10 p-0",
  hero: "h-11 min-h-11 gap-2 px-5 text-sm font-bold",
};

/** Shared chrome for native Button and Link CTAs — keeps geometry/focus aligned. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClassName({ variant, size, className })}
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
