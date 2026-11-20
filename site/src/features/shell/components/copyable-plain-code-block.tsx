"use client";

import { Button } from "@nexus/ui";
import { useState } from "react";

export function CopyablePlainCodeBlock({
  code,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-lg border border-base bg-inset p-3 text-xs text-secondary">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-11"
        onClick={() => void copyCode()}
      >
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
