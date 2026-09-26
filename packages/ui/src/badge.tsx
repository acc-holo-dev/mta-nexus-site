import * as React from "react";
import { cn } from "./utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default:
      "border-[color:var(--nexus-accent)]/20 bg-accent-soft text-accent",
    secondary: "border-base bg-inset text-secondary",
    success:
      "border-[color:var(--nexus-success)]/20 bg-success-soft text-success",
    warning:
      "border-[color:var(--nexus-warning)]/20 bg-warning-soft text-warning",
    danger:
      "border-[color:var(--nexus-danger)]/20 bg-danger-soft text-danger",
    outline: "border-base bg-transparent text-secondary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
