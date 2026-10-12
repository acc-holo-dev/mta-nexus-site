"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { communityReportCopy } from "../lib/community-report-copy";
import type { discussionReportsPageSchema } from "../lib/discussion-reports-contract";
import { discussionReportsCopy } from "../lib/discussion-reports-copy";
import type { Locale } from "../lib/i18n";
import {
  confirmsReportBatchCommand,
  confirmsReportBatchPreview,
  type ReportBatchPreview,
  reportBatchPreviewInput,
} from "../lib/report-batch-contract";
import { reportBatchCopy, reportBatchError } from "../lib/report-batch-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";

type Input = z.infer<typeof reportBatchPreviewInput>;
export function DiscussionReportBatch({
  contentId,
  commentId,
  items,
  locale,
  allowActions,
}: {
  contentId: string;
  commentId: string | null;
  items: z.infer<typeof discussionReportsPageSchema>["items"];
  locale: Locale;
  allowActions: boolean;
}) {
  const copy = reportBatchCopy(locale),
    labels = communityReportCopy(locale),
    router = useRouter();
  const [selected, setSelected] = useState<string[]>([]),
    [action, setAction] = useState<Input["action"]>("resolve"),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ReportBatchPreview | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false);
  const locked = useRef(false);
  const pending = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const available = items.filter((item) => ["open", "under_review"].includes(item.status));
  const path =
    commentId === null
      ? `/api/admin/community/${encodeURIComponent(contentId)}/reports/batch`
      : `/api/admin/community/${encodeURIComponent(contentId)}/discussion/${encodeURIComponent(commentId)}/reports/batch`;
  function safeMessage(failure: unknown, fallback: string) {
    const message = failure instanceof Error ? failure.message : "";
    return [
      ...Object.values(copy),
      ...Object.values(labels),
      ...Object.values(getUserPlatformCopy(locale)),
    ].includes(message)
      ? message
      : fallback;
  }
  function resetReview() {
    setPreview(null);
    setError("");
  }
  function toggle(id: string) {
    if (pending.current || locked.current || blocked || preview) return;
    resetReview();
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function input(): Input | null {
    const parsed = reportBatchPreviewInput.safeParse({
      items: items
        .filter((item) => selected.includes(item.id))
        .map((item) => ({ id: item.id, expectedStatus: item.status })),
      action,
      notes,
    });
    return parsed.success ? parsed.data : null;
  }
  async function review() {
    if (pending.current || locked.current || blocked) return;
    const payload = input();
    if (!payload) {
      setError(selected.length ? copy.invalid : copy.empty);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    const active = new AbortController();
    controller.current = active;
    try {
      const raw = await platformRequest(
        `${path}/preview`,
        locale,
        "POST",
        payload,
        active.signal,
        reportBatchError,
      );
      if (!mounted.current) return;
      const result = confirmsReportBatchPreview(raw, contentId, commentId, payload);
      if (!result) throw Error(copy.unavailable);
      setPreview(result);
    } catch (failure) {
      if (mounted.current) {
        const message = safeMessage(failure, copy.unavailable);
        setError(message);
        if (message === copy.changed || message === labels.forbidden) {
          locked.current = true;
          setBlocked(true);
        }
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function commit() {
    if (pending.current || locked.current || blocked || !preview) return;
    const reviewed = preview;
    pending.current = true;
    setBusy(true);
    setBlocked(true);
    locked.current = true;
    setError("");
    const active = new AbortController();
    controller.current = active;
    const payload = {
      items: reviewed.items.map((item) => ({ id: item.id, expectedStatus: item.before })),
      action: reviewed.action,
      notes: reviewed.notes,
      previewRevision: reviewed.previewRevision,
    };
    try {
      const result = await platformRequest(
        path,
        locale,
        "POST",
        payload,
        active.signal,
        reportBatchError,
      );
      if (!mounted.current) return;
      if (!confirmsReportBatchCommand(result, contentId, commentId, reviewed))
        throw Error(copy.uncertain);
      setSaved(true);
      setPreview(null);
      try {
        router.refresh();
      } catch {
        setError(copy.unavailable);
      }
    } catch (failure) {
      if (mounted.current) {
        setPreview(null);
        setError(safeMessage(failure, copy.uncertain));
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-busy={busy}>
      {allowActions && available.length > 0 && (
        <div className="nexus-panel space-y-4 p-5">
          <h2 className="text-lg font-semibold text-primary">{copy.title}</h2>
          <p className="text-sm text-muted">
            {commentId === null ? copy.publicationHelp : copy.help}
          </p>
          <p className="text-xs text-muted">
            {commentId === null ? copy.publicationActionHint : copy.noRemoval}
          </p>
          <fieldset disabled={busy || !!preview || blocked} className="space-y-4">
            <legend className="text-sm text-primary">
              {copy.selected}: {selected.length}
            </legend>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="min-h-11 text-sm text-accent underline"
                onClick={() => {
                  resetReview();
                  setSelected(available.map((item) => item.id));
                }}
              >
                {copy.selectAll}
              </button>
              <button
                type="button"
                className="min-h-11 text-sm text-accent underline"
                onClick={() => {
                  resetReview();
                  setSelected([]);
                }}
              >
                {copy.clear}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-primary">
                <span>{copy.action}</span>
                <select
                  className={platformFieldClass}
                  value={action}
                  onChange={(event) => {
                    resetReview();
                    setAction(event.target.value as Input["action"]);
                  }}
                >
                  {(["review", "resolve", "dismiss"] as const).map((value) => (
                    <option
                      key={value}
                      value={value}
                      disabled={
                        value === "review" &&
                        items.some((item) => selected.includes(item.id) && item.status !== "open")
                      }
                    >
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-primary">
                <span>{copy.notes}</span>
                <textarea
                  className={platformFieldClass}
                  rows={3}
                  minLength={3}
                  maxLength={2000}
                  value={notes}
                  onChange={(event) => {
                    resetReview();
                    setNotes(event.target.value);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!selected.length || notes.trim().length < 3}
              className="min-h-11 rounded-lg border border-base px-4 text-sm font-semibold text-accent disabled:opacity-50"
              onClick={() => void review()}
            >
              {copy.preview}
            </button>
          </fieldset>
        </div>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted">
          {copy.busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
      {blocked && !busy && (
        <button
          type="button"
          className="min-h-11 text-sm text-accent underline"
          onClick={() => window.location.reload()}
        >
          {copy.reload}
        </button>
      )}
      {preview && (
        <div className="nexus-panel space-y-4 p-5">
          <h3 className="font-semibold text-primary">{copy.previewTitle}</h3>
          <p className="break-words text-sm text-primary">{preview.publication.title}</p>
          <p className="text-sm font-semibold text-primary">
            {commentId === null ? copy.publication : copy.comment}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-primary">
            {preview.commentId === null && "text" in preview.publication
              ? preview.publication.text
              : (preview.comment?.text ?? copy.removed)}
          </p>
          {(preview.comment?.truncated ||
            (preview.commentId === null &&
              "truncated" in preview.publication &&
              preview.publication.truncated)) && (
            <p className="text-xs text-muted">{copy.truncated}</p>
          )}
          <p className="whitespace-pre-wrap break-words text-sm text-primary">
            {copy.notes}: {preview.notes}
          </p>
          <ol className="space-y-3">
            {preview.items.map((item) => (
              <li key={item.id} className="space-y-1 rounded-lg border border-base p-3">
                <Link
                  href={`/admin/reports/${encodeURIComponent(item.id)}`}
                  className="inline-flex min-h-11 text-sm text-accent underline"
                >
                  {labels[item.type]} · {item.id}
                </Link>
                <p className="whitespace-pre-wrap break-words text-sm text-primary">
                  {item.reason}
                </p>
                <p className="text-xs text-muted">
                  {copy.transition}: {labels[item.before]} → {labels[item.after]}
                </p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || blocked}
              className="min-h-11 rounded-lg border border-base px-4 text-sm font-semibold text-accent disabled:opacity-50"
              onClick={() => void commit()}
            >
              {copy.confirm}
            </button>
            <button
              type="button"
              disabled={busy || blocked}
              className="min-h-11 text-sm text-accent underline"
              onClick={() => setPreview(null)}
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      )}
      {items.length ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="nexus-panel space-y-3 p-5">
              {allowActions && ["open", "under_review"].includes(item.status) && (
                <label className="flex min-h-11 items-center gap-3 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={busy || !!preview || blocked}
                    onChange={() => toggle(item.id)}
                  />
                  <span>
                    {copy.select}: {item.id}
                  </span>
                </label>
              )}
              <p className="text-sm font-semibold text-primary">
                {labels[item.type]} · {labels[item.status]}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-primary">{item.reason}</p>
              <time dateTime={item.createdAt} className="text-xs text-muted">
                {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
              <Link
                href={`/admin/reports/${encodeURIComponent(item.id)}`}
                className="flex min-h-11 items-center text-sm text-accent underline"
              >
                {discussionReportsCopy(locale).review}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nexus-panel p-5 text-muted">
          {commentId === null ? copy.publicationEmpty : discussionReportsCopy(locale).empty}
        </p>
      )}
    </section>
  );
}
