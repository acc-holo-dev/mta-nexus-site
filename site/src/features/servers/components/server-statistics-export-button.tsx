"use client";
import { Button, ErrorState } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { linkGhostAccentSm, linkMinHAccentSemibold } from "../../shell/link-shell";
import { typeItemsStretchPy4 } from "../../shell/type-shell";
import { serverStatisticsCopy, serverStatisticsError } from "../server-statistics-copy";
import { fetchServerStatisticsCsv } from "../server-statistics-download";
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
  const copy = serverStatisticsCopy(locale);
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
      <Button
        type="button"
        variant="secondary"
        onClick={download}
        disabled={disabled || busy}
        isLoading={busy}
        className={linkMinHAccentSemibold}
      >
        {busy ? copy.downloading : label}
      </Button>
      {error ? (
        <ErrorState
          title={error}
          description={copy.exportErrorHint}
          className={typeItemsStretchPy4}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || busy}
              onClick={() => void download()}
              className={linkGhostAccentSm}
            >
              {copy.retry}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
