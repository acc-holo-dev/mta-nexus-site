import * as React from "react";
import { cn } from "./utils";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({ isOpen, onClose, title, description, children }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {description && <p className="text-sm text-neutral-400 mt-1">{description}</p>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
