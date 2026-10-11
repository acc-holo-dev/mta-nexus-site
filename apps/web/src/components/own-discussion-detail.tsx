"use client";
import { useState } from "react";
import Link from "next/link";
import type { OwnDiscussion } from "../lib/discussion-workspace-contract";
import type { Locale } from "../lib/i18n";
import { ownDiscussionCopy } from "../lib/discussion-workspace-copy";
import { DiscussionCommentActions } from "./discussion-comment-actions";
export function OwnDiscussionDetail({
  initial,
  locale,
}: {
  initial: OwnDiscussion;
  locale: Locale;
}) {
  const copy = ownDiscussionCopy(locale),
    [comment, setComment] = useState(initial),
    [removed, setRemoved] = useState(false),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false);
  if (removed)
    return (
      <div className="nexus-panel space-y-4 p-6">
        <p role="status" className="text-sm text-success">
          {copy.removed}
        </p>
        <Link
          href="/workspace/discussions"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.back}
        </Link>
      </div>
    );
  return (
    <article className="nexus-panel space-y-4 p-6" aria-busy={pending}>
      <h1 className="break-words text-xl font-bold text-primary">{comment.title ?? copy.hidden}</h1>
      {!comment.available && <p className="text-sm text-muted">{copy.hiddenNote}</p>}
      {!comment.editable && <p className="text-sm text-muted">{copy.readOnly}</p>}
      <time dateTime={comment.createdAt} className="text-xs text-muted">
        {new Date(comment.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
          timeZone: "UTC",
          timeZoneName: "short",
        })}
      </time>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
        {comment.text}
      </p>
      {comment.slug && (
        <Link
          prefetch={false}
          href={`/articles/${encodeURIComponent(comment.slug)}?comment=${encodeURIComponent(comment.id)}#comment-${encodeURIComponent(comment.id)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.discussion}
        </Link>
      )}
      <DiscussionCommentActions
        key={comment.revision}
        comment={{
          id: comment.id,
          text: comment.text,
          revision: comment.revision,
          parentId: null,
          parent: null,
          author: null,
          createdAt: comment.createdAt,
        }}
        own
        editable={comment.editable}
        slug={comment.slug ?? ""}
        contentId={comment.contentId}
        locale={locale}
        disabled={pending}
        endpoint={`/api/workspace/discussions/${encodeURIComponent(comment.id)}`}
        recoveryHref={`/workspace/discussions/${encodeURIComponent(comment.id)}`}
        onPending={(value) => {
          setPending(value);
          if (value) setSaved(false);
        }}
        onSaved={(text, revision) => {
          if (text === undefined) setRemoved(true);
          else if (revision) {
            setComment((current) => ({ ...current, text, revision }));
            setSaved(true);
          }
        }}
      />
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.edited}
        </p>
      )}
      <p className="text-xs text-muted">{copy.privacy}</p>
    </article>
  );
}
