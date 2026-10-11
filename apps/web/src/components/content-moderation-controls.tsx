"use client";

import { Archive, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import { useNexusLocale } from "./locale-context";

export function ContentModerationControls({
  contentId,
  expectedUpdatedAt,
}: {
  contentId: string;
  expectedUpdatedAt: string;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"publish" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestPending = useRef(false);
  const hasNotes = notes.trim().length >= 3;

  async function moderate(action: "publish" | "archive") {
    if (!hasNotes || requestPending.current) return;

    const confirmed = window.confirm(
      action === "publish" ? copy.publishContentConfirm : copy.archiveContentConfirm,
    );
    if (!confirmed) return;

    requestPending.current = true;
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "content",
          targetId: contentId,
          action,
          notes: notes.trim(),
          expectedUpdatedAt,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!confirmsAdminAction(response.status, data, contentId, action)) {
        setError(
          data?.code === "CONTENT_STATE_CHANGED"
            ? locale === "ru"
              ? "Публикация изменилась. Загрузите и проверьте новую версию перед решением."
              : "The publication changed. Reload and review the new version before deciding."
            : copy.contentFailed,
        );
        return;
      }

      setNotes("");
      router.refresh();
    } catch {
      setError(copy.contentUnavailable);
    } finally {
      requestPending.current = false;
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 md:w-80" aria-busy={pending !== null}>
      <label className="block space-y-1">
        <span className="font-label uppercase text-muted">{copy.reviewNote}</span>
        <textarea
          disabled={pending !== null}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          minLength={3}
          maxLength={2000}
          rows={2}
          placeholder={copy.reviewNoteAudit}
          className="w-full resize-y rounded-md border border-base bg-inset px-2.5 py-2 text-xs text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasNotes || requestPending.current !== null}
          onClick={() => void moderate("publish")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--nexus-success)]/25 bg-success-soft px-3 py-2 text-[11px] font-semibold text-success transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "publish" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.publish}
        </button>

        <button
          type="button"
          disabled={!hasNotes || requestPending.current !== null}
          onClick={() => void moderate("archive")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-base bg-surface px-3 py-2 text-[11px] font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "archive" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.archive}
        </button>
      </div>

      {!hasNotes && <p className="text-[10px] text-faint">{copy.reviewNoteHint}</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-[11px] text-danger">
            {error}
          </p>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => window.location.reload()}
            className="text-xs text-accent underline"
          >
            {locale === "ru" ? "Загрузить сохранённую версию" : "Reload saved version"}
          </button>
        </div>
      )}
    </div>
  );
}
