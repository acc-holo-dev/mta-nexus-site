import { AlertTriangle } from "lucide-react";
import type * as React from "react";
import { cn } from "./utils";

export interface ErrorStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Honest failure state with an adjacent recovery action when one is available. */
export function ErrorState({ title, description, icon, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-[color:var(--nexus-danger)]/30 bg-danger-soft px-4 py-8 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--nexus-danger)]/30 bg-surface text-danger">
        {icon || <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2 className="max-w-lg break-words text-base font-semibold text-primary">{title}</h2>
      {description && <p className="mt-1 max-w-lg text-sm text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
