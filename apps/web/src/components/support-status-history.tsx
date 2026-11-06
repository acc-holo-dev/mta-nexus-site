"use client";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { supportActivitySchema } from "../lib/support-workspace-contract";
import { supportWorkspaceCopy, supportWorkspaceError } from "../lib/support-workspace-copy";
import { useNexusLocale } from "./locale-context";

const ghostActionClass =
  "h-auto min-h-11 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function SupportStatusHistory({
  caseId,
  actorId,
  revision,
}: {
  caseId: string;
  actorId: string;
  revision?: string;
}) {
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
        if (body?.actorId !== actorId) throw new Error();
        const parsed = supportActivitySchema.safeParse(body);
        if (!parsed.success) throw new Error();
        setData(parsed.data);
      } catch {
        if (!controller.signal.aborted) setError(copy.historyUnavailable);
      }
    })();
    return () => controller.abort();
  }, [caseId, actorId, revision, open, before, retry, locale, copy.historyUnavailable]);
  const label = (status: string) =>
    status === "open"
      ? dictionary.support.open
      : status === "resolved"
        ? dictionary.support.resolved
        : dictionary.support.closed;
  return (
    <details
      className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer font-heading text-primary">
        {copy.history}
      </summary>
      {open && (
        <div className="min-w-0 space-y-3 overflow-x-clip" aria-live="polite">
          {error ? (
            <ErrorState
              id="support-status-history-unavailable"
              title={error}
              description={copy.historyUnavailableDescription}
              action={
                <Button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                  className={ghostActionClass}
                  variant="ghost"
                >
                  {copy.reload}
                </Button>
              }
            />
          ) : !data ? (
            <p role="status" className="text-sm text-muted">
              {dictionary.support.historyLoading}
            </p>
          ) : data.items.length === 0 ? (
            <EmptyState
              title={copy.historyEmpty}
              description={copy.historyEmptyHint}
              icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
            />
          ) : (
            <ol className="min-w-0 space-y-3 overflow-x-clip">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 overflow-x-clip border-b border-base pb-2 text-sm text-secondary"
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
          <nav className="flex min-w-0 flex-wrap gap-4" aria-label={copy.history}>
            {before && (
              <Button
                type="button"
                onClick={() => setBefore(undefined)}
                className={ghostActionClass}
                variant="ghost"
              >
                {copy.latest}
              </Button>
            )}
            {data?.nextCursor && (
              <Button
                type="button"
                onClick={() => setBefore(data.nextCursor ?? undefined)}
                className={ghostActionClass}
                variant="ghost"
              >
                {copy.older}
              </Button>
            )}
          </nav>
        </div>
      )}
    </details>
  );
}
