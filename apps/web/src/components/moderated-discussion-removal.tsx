"use client";
import { Button } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { moderationCopy } from "../lib/community-moderation-copy";
import type { Locale } from "../lib/i18n";
import {
  confirmsModeratedDiscussionRemoval,
  moderatedDiscussionHref,
  moderatedDiscussionRemoveSchema,
} from "../lib/moderated-discussion-contract";
import {
  moderatedDiscussionCopy,
  moderatedDiscussionError,
} from "../lib/moderated-discussion-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
export function ModeratedDiscussionRemoval({
  contentId,
  commentId,
  revision,
  locale,
}: {
  contentId: string;
  commentId: string;
  revision: string;
  locale: Locale;
}) {
  const [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const guard = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    router = useRouter(),
    copy = moderatedDiscussionCopy(locale),
    general = moderationCopy(locale);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function remove() {
    const input = moderatedDiscussionRemoveSchema.safeParse({ reason, expectedRevision: revision });
    if (guard.current || blocked || !input.success || !window.confirm(copy.confirm)) return;
    guard.current = true;
    setPending(true);
    setError("");
    setMessage("");
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await platformRequest(
        `/api/admin/community/${encodeURIComponent(contentId)}/discussion/${encodeURIComponent(commentId)}`,
        locale,
        "POST",
        input.data,
        request.signal,
        moderatedDiscussionError,
      );
      if (!confirmsModeratedDiscussionRemoval(result, contentId, commentId))
        throw new Error(general.uncertain);
      if (alive.current) {
        setBlocked(true);
        setMessage(copy.saved);
        router.refresh();
      }
    } catch (failure) {
      if (alive.current) {
        setBlocked(true);
        setError(failure instanceof Error ? failure.message : general.uncertain);
      }
    } finally {
      guard.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-base p-4" aria-busy={pending}>
      <label className="block space-y-2 text-sm text-primary">
        <span>{copy.reason}</span>
        <textarea
          className={platformFieldClass}
          rows={4}
          minLength={3}
          maxLength={1000}
          value={reason}
          disabled={pending || blocked}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <Button
        type="button"
        className="min-h-11"
        disabled={
          pending ||
          blocked ||
          !moderatedDiscussionRemoveSchema.safeParse({ reason, expectedRevision: revision }).success
        }
        onClick={() => void remove()}
      >
        {pending ? copy.saving : copy.remove}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      )}
      {blocked && (
        <a
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href={moderatedDiscussionHref(contentId, undefined, undefined, commentId)}
        >
          {general.reload}
        </a>
      )}
    </section>
  );
}
