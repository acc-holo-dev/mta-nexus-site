"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { fetchServerStatisticsCsv } from "../lib/server-statistics-download";
import { serverStatisticsCopy, serverStatisticsError } from "../lib/server-statistics-copy";

export function ServerStatisticsExportButton({
  url,
  label,
  locale,
  disabled = false,
}: {
  url: string;
  label: string;
  locale: Locale;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await fetchServerStatisticsCsv(url, locale, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const objectUrl = URL.createObjectURL(result.blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = "mta-server-statistics.csv";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch {
      if (!controller.signal.aborted) setError(serverStatisticsError(locale, "INTERNAL_ERROR"));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={download}
        disabled={disabled || busy}
        aria-busy={busy}
        className="min-h-11 rounded-lg border border-base bg-inset px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50"
      >
        {busy ? serverStatisticsCopy(locale).downloading : label}
      </button>
      {error && (
        <p role="alert" className="max-w-md text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
