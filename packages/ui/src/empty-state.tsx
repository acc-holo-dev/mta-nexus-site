import type * as React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "./utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-base bg-inset px-4 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-base bg-surface text-muted shadow-nexus-sm">
        {icon || <FolderOpen className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      <p className="mb-6 mt-1 max-w-sm text-sm text-muted">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
