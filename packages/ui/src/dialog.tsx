import * as React from "react";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexus-dialog-title"
        aria-describedby={description ? "nexus-dialog-description" : undefined}
        className="relative w-full max-w-lg rounded-xl border border-base bg-elevated p-6 text-primary shadow-nexus-lg"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 pr-8">
          <h3 id="nexus-dialog-title" className="text-lg font-bold text-primary">
            {title}
          </h3>
          {description && (
            <p
              id="nexus-dialog-description"
              className="mt-1 text-sm text-muted"
            >
              {description}
            </p>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
