"use client";
import { Button } from "@nexus/ui";

import { Archive, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmsAdminAction } from "../lib/admin-action-confirmation";
import {
  confirmsModerationCommand,
  moderationDetailHref,
} from "../lib/community-moderation-contract";
import { moderationCopy, moderationError } from "../lib/community-moderation-copy";
import { useNexusLocale } from "./locale-context";

export function ContentModerationControls({
  contentId,
  expectedUpdatedAt,
  status,
  workspace = false,
  truncated = false,
}: {
  contentId: string;
  expectedUpdatedAt: string;
  status?: string;
  workspace?: boolean;
  truncated?: boolean;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.admin;
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"publish" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false);
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const requestPending = useRef(false);
  const hasNotes = notes.trim().length >= 3;

  async function moderate(action: "publish" | "archive") {
    if (
      !hasNotes ||
      requestPending.current ||
      blocked ||
      (action === "publish" && (status === "published" || truncated)) ||
      (action === "archive" && status === "archived")
    )
      return;

    const confirmed = window.confirm(
      action === "publish" ? copy.publishContentConfirm : copy.archiveContentConfirm,
    );
    if (!confirmed) return;

    requestPending.current = true;
    setPending(action);
    setError(null);
    const request = new AbortController();
    controller.current = request;
    try {
      const response = await fetch(
        workspace ? `/api/admin/community/${encodeURIComponent(contentId)}` : "/api/admin/actions",
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(!workspace ? { targetType: "content", targetId: contentId } : {}),
            action,
            notes: notes.trim(),
            expectedUpdatedAt,
          }),
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
        },
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (
        !(workspace
          ? response.ok && confirmsModerationCommand(data, contentId, action, expectedUpdatedAt)
          : confirmsAdminAction(response.status, data, contentId, action))
      ) {
        setBlocked(true);
        setError(
          workspace
            ? moderationError(locale, response.ok ? "UNCONFIRMED" : data?.code)
            : data?.code === "CONTENT_STATE_CHANGED"
              ? locale === "ru"
                ? "Публикация изменилась. Загрузите и проверьте новую версию перед решением."
                : "The publication changed. Reload and review the new version before deciding."
              : copy.contentFailed,
        );
        return;
      }

      setNotes("");
      setBlocked(true);
      setSaved(true);
      router.refresh();
    } catch {
      if (alive.current) {
        setBlocked(true);
        setError(workspace ? moderationCopy(locale).uncertain : copy.contentUnavailable);
      }
    } finally {
      requestPending.current = false;
      if (alive.current) setPending(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2 md:w-80" aria-busy={pending !== null}>
      <label className="block space-y-1">
        <span className="font-label uppercase text-muted">{copy.reviewNote}</span>
        <textarea
          disabled={pending !== null || blocked}
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
        <Button
          type="button"
          disabled={!hasNotes || pending !== null || blocked || status === "published" || truncated}
          onClick={() => void moderate("publish")}
          className="min-h-9 gap-1.5 bg-success-soft text-success text-[11px]"
          variant="outline"
        >
          {pending === "publish" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.publish}
        </Button>

        <Button
          type="button"
          disabled={!hasNotes || pending !== null || blocked || status === "archived"}
          onClick={() => void moderate("archive")}
          className="min-h-9 gap-1.5 text-[11px]"
          variant="outline"
        >
          {pending === "archive" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copy.archive}
        </Button>
      </div>

      {!hasNotes && <p className="text-[10px] text-faint">{copy.reviewNoteHint}</p>}
      {saved && (
        <p role="status" className="text-sm text-success">
          {moderationCopy(locale).saved}
        </p>
      )}
      {saved && (
        <a
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href={workspace ? moderationDetailHref(contentId) : "/admin"}
        >
          {moderationCopy(locale).reload}
        </a>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-[11px] text-danger">
            {error}
          </p>
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => window.location.reload()}
            className="h-auto min-h-11 px-0 text-sm text-accent underline"
            variant="ghost"
          >
            {locale === "ru" ? "Загрузить сохранённую версию" : "Reload saved version"}
          </Button>
        </div>
      )}
    </div>
  );
}
