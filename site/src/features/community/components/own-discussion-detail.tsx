"use client";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { linkAccentSm } from "../../shell/link-shell";
import { panelClipSpace4P6 } from "../../shell/panel-shell";
import { typePrewrapSmLeadingSecondary, typeSmSuccess, typeXsMuted } from "../../shell/type-shell";
import type { OwnDiscussion } from "../discussion-workspace-contract";
import { ownDiscussionCopy } from "../discussion-workspace-copy";
import { DiscussionCommentActions } from "./discussion-comment-actions";
export function OwnDiscussionDetail({
  initial,
  locale,
  listHref = "/workspace/discussions",
  recoveryHref,
}: {
  initial: OwnDiscussion;
  locale: Locale;
  listHref?: string;
  recoveryHref?: string;
}) {
  const copy = ownDiscussionCopy(locale),
    [comment, setComment] = useState(initial),
    [removed, setRemoved] = useState(false),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false);
  if (removed)
    return (
      <div className={panelClipSpace4P6}>
        <p role="status" className={typeSmSuccess}>
          {copy.removed}
        </p>
        <Link href={listHref} className={linkAccentSm}>
          {copy.back}
        </Link>
      </div>
    );
  return (
    <article className={panelClipSpace4P6} aria-busy={pending}>
      <h1 className="min-w-0 break-words text-xl font-bold text-primary">
        {comment.title ?? copy.hidden}
      </h1>
      {!comment.available ? (
        <ErrorState
          id="own-discussion-publication-unavailable"
          title={copy.hiddenNote}
          description={copy.hiddenPublicationHint}
        />
      ) : null}
      {!comment.editable && (
        <ErrorState
          id="own-discussion-readonly"
          title={copy.readOnly}
          description={copy.readOnlyHint}
        />
      )}
      <time dateTime={comment.createdAt} className={typeXsMuted}>
        {new Date(comment.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
          timeZone: "UTC",
          timeZoneName: "short",
        })}
      </time>
      <p className={typePrewrapSmLeadingSecondary}>{comment.text}</p>
      {comment.slug && (
        <Link
          prefetch={false}
          href={`/articles/${encodeURIComponent(comment.slug)}?comment=${encodeURIComponent(comment.id)}#comment-${encodeURIComponent(comment.id)}`}
          className={linkAccentSm}
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
        recoveryHref={recoveryHref ?? `/workspace/discussions/${encodeURIComponent(comment.id)}`}
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
        <p role="status" className={typeSmSuccess}>
          {copy.edited}
        </p>
      )}
      <p className={typeXsMuted}>{copy.privacy}</p>
    </article>
  );
}
