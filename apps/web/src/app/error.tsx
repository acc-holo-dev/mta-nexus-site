"use client";

import { Button } from "@nexus/ui";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useNexusLocale } from "../components/locale-context";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dictionary } = useNexusLocale();

  return (
    <div className="mx-auto max-w-lg space-y-5 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-primary">{dictionary.errors.title}</h1>
        <p className="mx-auto max-w-sm font-caption leading-relaxed text-muted">
          {dictionary.errors.message}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={reset}
          className="gap-1.5 rounded-md px-4 font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{dictionary.errors.retry}</span>
        </Button>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md border border-base bg-elevated px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{dictionary.errors.home}</span>
        </Link>
      </div>
    </div>
  );
}
