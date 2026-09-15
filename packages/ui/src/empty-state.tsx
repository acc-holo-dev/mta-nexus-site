import * as React from "react";
import { cn } from "./utils";
import { FolderOpen } from "lucide-react";

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
        "flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30",
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 mb-4">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-neutral-200">{title}</h3>
      <p className="text-sm text-neutral-400 mt-1 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
