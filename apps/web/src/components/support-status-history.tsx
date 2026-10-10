"use client";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { supportActivitySchema } from "../lib/support-workspace-contract";
import { supportWorkspaceCopy, supportWorkspaceError } from "../lib/support-workspace-copy";
import { useNexusLocale } from "./locale-context";
export function SupportStatusHistory({ caseId, revision }: { caseId: string; revision?: string }) {
  const { locale, dictionary } = useNexusLocale(),
    copy = supportWorkspaceCopy(locale);
  const [open, setOpen] = useState(false),
    [before, setBefore] = useState<string | undefined>(),
    [retry, setRetry] = useState(0);
  const [data, setData] = useState<z.infer<typeof supportActivitySchema> | null>(null),
    [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Saved revisions and explicit retries intentionally refresh this private history.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setData(null);
    setError("");
    void (async () => {
      try {
        const params = before ? `?${new URLSearchParams({ before })}` : "";
        const response = await fetch(
          `/api/support/${encodeURIComponent(caseId)}/activity${params}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
          },
        );
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(supportWorkspaceError(locale, body?.code ?? response.status));
          return;
        }
        const parsed = supportActivitySchema.safeParse(body);
        if (!parsed.success) throw new Error();
        setData(parsed.data);
      } catch {
        if (!controller.signal.aborted) setError(copy.historyUnavailable);
      }
    })();
    return () => controller.abort();
  }, [caseId, revision, open, before, retry, locale, copy.historyUnavailable]);
  const label = (status: string) =>
    status === "open"
      ? dictionary.support.open
      : status === "resolved"
        ? dictionary.support.resolved
        : dictionary.support.closed;
  return (
    <details
      className="nexus-panel space-y-3 p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-9 cursor-pointer font-heading text-primary">{copy.history}</summary>
      {open && (
        <div className="space-y-3" aria-live="polite">
          {error ? (
            <>
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="min-h-9 text-sm text-accent underline"
              >
                {copy.reload}
              </button>
            </>
          ) : !data ? (
            <p className="text-sm text-muted">{dictionary.support.loading}</p>
          ) : data.items.length === 0 ? (
            <p className="text-sm text-muted">{copy.historyEmpty}</p>
          ) : (
            <ol className="space-y-3">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap gap-x-3 gap-y-1 border-b border-base pb-2 text-sm text-secondary"
                >
                  <span>
                    {label(item.from)} → {label(item.to)}
                  </span>
                  <span className="text-muted">
                    {item.by === "staff" ? dictionary.support.staff : dictionary.support.requester}
                  </span>
                  <time dateTime={item.createdAt} className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <nav className="flex flex-wrap gap-4" aria-label={copy.history}>
            {before && (
              <button
                type="button"
                onClick={() => setBefore(undefined)}
                className="min-h-9 text-sm text-accent underline"
              >
                {copy.latest}
              </button>
            )}
            {data?.nextCursor && (
              <button
                type="button"
                onClick={() => setBefore(data.nextCursor ?? undefined)}
                className="min-h-9 text-sm text-accent underline"
              >
                {copy.older}
              </button>
            )}
          </nav>
        </div>
      )}
    </details>
  );
}
