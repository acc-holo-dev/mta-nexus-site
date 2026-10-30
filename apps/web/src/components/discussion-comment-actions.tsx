"use client";
import { Button } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import type { DiscussionPage } from "../lib/content-discussion-contract";
import { discussionMutationError, getDiscussionCopy } from "../lib/content-discussion-copy";
import { confirmsDiscussionMutation } from "../lib/discussion-mutation-confirmation";
import type { Locale } from "../lib/i18n";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
export function DiscussionCommentActions({
  comment,
  own,
  slug,
  contentId,
  locale,
  disabled,
  onPending,
  onSaved,
  endpoint,
  recoveryHref,
  editable = true,
}: {
  comment: DiscussionPage["items"][number];
  own: boolean;
  slug: string;
  contentId: string;
  locale: Locale;
  disabled: boolean;
  onPending: (pending: boolean) => void;
  onSaved: (text?: string, revision?: string) => void;
  endpoint?: string;
  recoveryHref?: string;
  editable?: boolean;
}) {
  const copy = getDiscussionCopy(locale);
  const [mode, setMode] = useState<"edit" | "remove" | null>(null),
    [text, setText] = useState(comment.text);
  // A refresh may replace the row while a draft/confirmation is open.
  const [revision, setRevision] = useState(comment.revision);
  const stale = mode !== null && revision !== comment.revision;
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function submit() {
    if (
      busy.current ||
      disabled ||
      blocked ||
      !mode ||
      !revision ||
      stale ||
      (mode === "edit" && !editable)
    )
      return;
    const value = mode === "edit" ? text.trim() : undefined;
    if (value !== undefined && (value.length < 2 || value.length > 5000)) {
      setError(copy.invalid);
      return;
    }
    if (!own && !reason.trim()) {
      setError(copy.reasonRequired);
      return;
    }
    busy.current = true;
    setPending(true);
    onPending(true);
    setError("");
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await platformRequest(
        endpoint ??
          `/api/content/${encodeURIComponent(slug)}/comments/${encodeURIComponent(comment.id)}`,
        locale,
        mode === "edit" ? "PATCH" : "DELETE",
        {
          expectedRevision: revision,
          ...(value !== undefined ? { text: value } : !own ? { reason: reason.trim() } : {}),
        },
        request.signal,
        discussionMutationError,
      );
      if (!confirmsDiscussionMutation(result, contentId, comment.id, value))
        throw new Error(copy.writeUnavailable);
      if (!alive.current) return;
      setMode(null);
      onSaved(value, result.revision);
    } catch (failure) {
      if (alive.current) {
        setBlocked(true);
        setError(failure instanceof Error ? failure.message : copy.writeUnavailable);
      }
    } finally {
      busy.current = false;
      onPending(false);
      if (alive.current) setPending(false);
    }
  }
  return (
    <div className="space-y-3" aria-busy={pending}>
      {!mode ? (
        <div className="flex flex-wrap gap-3">
          {own && editable && (
            <Button
              type="button"
              className="min-h-9 text-xs"
              disabled={disabled || blocked}
              onClick={() => {
                setText(comment.text);
                setRevision(comment.revision);
                setError("");
                setMode("edit");
              }}
              variant="outline"
            >
              {copy.edit}
            </Button>
          )}
          <Button
            type="button"
            className="min-h-9 text-xs"
            disabled={disabled || blocked}
            onClick={() => {
              setRevision(comment.revision);
              setError("");
              setMode("remove");
            }}
            variant="outline"
          >
            {copy.remove}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-3 rounded-lg border border-base p-3"
        >
          {mode === "edit" ? (
            <label className="block space-y-1 text-xs text-secondary">
              {copy.label}
              <textarea
                rows={4}
                minLength={2}
                maxLength={5000}
                required
                disabled={pending || disabled}
                value={text}
                onChange={(event) => setText(event.target.value)}
                className={platformFieldClass}
              />
            </label>
          ) : (
            <>
              <p className="text-sm text-secondary">{copy.removeNote}</p>
              {!own && (
                <label className="block space-y-1 text-xs text-secondary">
                  {copy.reason}
                  <textarea
                    rows={2}
                    maxLength={1000}
                    required
                    disabled={pending || disabled}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className={platformFieldClass}
                  />
                </label>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              className="min-h-9 text-xs"
              disabled={pending || disabled || stale || blocked}
              variant="outline"
            >
              {mode === "edit" ? copy.saveEdit : copy.confirmRemove}
            </Button>
            <Button
              type="button"
              className="min-h-9 text-xs"
              disabled={pending}
              onClick={() => setMode(null)}
              variant="outline"
            >
              {copy.cancelEdit}
            </Button>
          </div>
        </form>
      )}
      {(error || stale) && (
        <p role="alert" className="text-sm text-danger">
          {stale ? copy.changed : error}
        </p>
      )}
      {(blocked || stale) && (
        <a
          href={
            recoveryHref ??
            `/articles/${encodeURIComponent(slug)}?comment=${encodeURIComponent(comment.id)}#comment-${encodeURIComponent(comment.id)}`
          }
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reloadSaved}
        </a>
      )}
    </div>
  );
}
