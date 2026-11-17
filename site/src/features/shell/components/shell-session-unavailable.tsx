"use client";

import { Button } from "@nexus/ui";
import { RefreshCw } from "lucide-react";
import { getDictionary, type Locale } from "../../../lib/platform/i18n";

/** A failed probe never claims that the visitor has signed out. */
export function ShellSessionUnavailable({
  locale,
  retry,
  compact = false,
}: {
  locale: Locale;
  retry: () => void;
  compact?: boolean;
}) {
  const copy = getDictionary(locale).accountControls;
  return (
    <div className="space-y-1 text-xs text-muted">
      <p role="status" className={compact ? "sr-only" : "break-words"}>
        {copy.checkError}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="touch"
        onClick={retry}
        aria-label={compact ? `${copy.checkError} ${copy.retry}` : undefined}
        title={compact ? copy.checkError : undefined}
        className={compact ? "w-full px-0" : "px-2"}
      >
        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <span>{copy.retry}</span>}
      </Button>
    </div>
  );
}
