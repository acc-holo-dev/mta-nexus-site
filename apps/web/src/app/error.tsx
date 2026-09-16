"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-5">
      <div className="w-14 h-14 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-primary">Something went wrong</h1>
        <p className="font-caption text-muted max-w-sm mx-auto leading-relaxed">
          An unexpected error occurred while loading this page. Your data is safe — this is a
          temporary issue, not a problem with your account.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-elevated border border-base text-secondary hover:text-primary text-xs font-semibold transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Go Home</span>
        </Link>
      </div>
    </div>
  );
}
