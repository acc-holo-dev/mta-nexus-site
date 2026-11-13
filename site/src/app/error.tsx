"use client";

import { Button } from "@nexus/ui";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNexusLocale } from "../components/locale-context";
import { readSafePublicErrorReference } from "../lib/safe-public-error-reference";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dictionary } = useNexusLocale();
  const reference = readSafePublicErrorReference(error);
  const [copyMessage, setCopyMessage] = useState("");

  async function copyReference() {
    if (!reference) return;
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(reference);
      setCopyMessage(dictionary.errors.referenceCopied);
    } catch {
      setCopyMessage(dictionary.errors.referenceCopyUnavailable);
    }
  }

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

      {reference ? (
        <div className="mx-auto max-w-sm space-y-2 rounded-lg border border-base bg-elevated px-4 py-3 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {dictionary.errors.referenceLabel}
          </p>
          <code
            data-testid="error-public-reference"
            className="block break-all font-mono text-sm text-primary"
          >
            {reference}
          </code>
          <p className="font-caption text-muted">{dictionary.errors.referenceHint}</p>
          <Button
            type="button"
            size="touch"
            variant="outline"
            onClick={() => void copyReference()}
            className="rounded-md px-3 font-semibold"
          >
            {dictionary.errors.copyReference}
          </Button>
          {copyMessage ? (
            <p role="status" className="font-caption text-muted">
              {copyMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          size="touch"
          onClick={reset}
          className="gap-1.5 rounded-md px-4 font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{dictionary.errors.retry}</span>
        </Button>
        <Link
          href="/"
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-base bg-elevated px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{dictionary.errors.home}</span>
        </Link>
      </div>
    </div>
  );
}
