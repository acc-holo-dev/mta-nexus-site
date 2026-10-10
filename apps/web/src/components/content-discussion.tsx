"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Avatar, Button } from "@nexus/ui";
import type { Locale } from "../lib/i18n";
import { getDiscussionCopy, discussionError } from "../lib/content-discussion-copy";
import { discussionPageSchema, type DiscussionPage } from "../lib/content-discussion-contract";
import { submitContentCommentRequest } from "../lib/content-comment-client";
import { privateApiRequest } from "../lib/private-api-request";
import { platformFieldClass } from "../lib/user-platform-client";

export function ContentDiscussion({
  slug,
  contentId,
  locale,
  count,
  initial,
}: {
  slug: string;
  contentId: string;
  locale: Locale;
  count: number;
  initial: DiscussionPage | null;
}) {
  const copy = getDiscussionCopy(locale);
  const [page, setPage] = useState<DiscussionPage | null>(initial);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(initial ? "" : copy.unavailable);
  const [writeError, setWriteError] = useState("");
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);
  const [displayCount, setDisplayCount] = useState(count);
  const readGuard = useRef(false);
  const writeGuard = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const path = `/api/content/${encodeURIComponent(slug)}/comments`;
  async function load(older = false) {
    if (readGuard.current || (older && !page?.nextCursor)) return;
    readGuard.current = true;
    setLoading(true);
    setReadError("");
    const cursor = older ? page?.nextCursor : null;
    try {
      const response = await fetch(
        `${path}${cursor ? `?${new URLSearchParams({ cursor })}` : ""}`,
        privateApiRequest({ timeoutMs: 15_000 }),
      ).catch(() => {
        throw new Error(copy.unavailable);
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          discussionError(
            locale,
            payload && typeof payload === "object" && "code" in payload
              ? payload.code
              : "INTERNAL_ERROR",
          ),
        );
      const parsed = discussionPageSchema.safeParse(payload);
      if (!parsed.success) throw new Error(copy.unavailable);
      setPage((current) => ({
        ...parsed.data,
        items:
          older && current
            ? [
                ...current.items,
                ...parsed.data.items.filter(
                  (item) => !current.items.some((existing) => existing.id === item.id),
                ),
              ].slice(-200)
            : parsed.data.items,
      }));
      return true;
    } catch (caught) {
      setReadError(caught instanceof Error ? caught.message : copy.unavailable);
      return false;
    } finally {
      readGuard.current = false;
      setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writeGuard.current || readGuard.current) return;
    const normalized = text.trim();
    if (normalized.length < 2 || normalized.length > 5000) {
      setWriteError(copy.invalid);
      return;
    }
    writeGuard.current = true;
    setSubmitting(true);
    setWriteError("");
    setPublished(false);
    try {
      await submitContentCommentRequest({
        slug,
        contentId,
        parentId: reply?.id,
        text: normalized,
        locale,
        fallbackError: copy.writeUnavailable,
      });
      setText("");
      setReply(null);
      setPublished(true);
      setDisplayCount((current) => current + 1);
      // Saved state is independent from a subsequent read failure.
      await load();
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      writeGuard.current = false;
      setSubmitting(false);
    }
  }
  return (
    <section id="discussion" className="nexus-panel space-y-5 p-5 sm:p-6">
      <h2 className="font-heading text-primary">
        {copy.title} ({displayCount})
      </h2>
      <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
        {reply && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent-soft p-3 text-sm text-secondary">
            <span>
              {copy.replying} {reply.name}
            </span>
            <button
              className="text-accent underline"
              type="button"
              disabled={submitting}
              onClick={() => setReply(null)}
            >
              {copy.cancel}
            </button>
          </div>
        )}
        <label className="block space-y-1 text-sm text-secondary">
          <span>{copy.label}</span>
          <textarea
            ref={textarea}
            className={platformFieldClass}
            required
            minLength={2}
            maxLength={5000}
            rows={4}
            placeholder={copy.placeholder}
            disabled={submitting}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={submitting} disabled={text.trim().length < 2 || loading}>
            {submitting ? copy.publishing : copy.publish}
          </Button>
          <span className="text-xs text-muted">{text.length}/5000</span>
          <Link className="text-xs text-accent underline" href="/auth/login">
            {copy.signIn}
          </Link>
        </div>
        {writeError && (
          <p role="alert" className="text-sm text-danger">
            {writeError}
          </p>
        )}
        {published && (
          <p role="status" className="text-sm text-accent">
            {copy.saved}
          </p>
        )}
      </form>
      <div className="space-y-3" aria-busy={loading}>
        {page?.items.map((comment) => (
          <article
            id={`comment-${comment.id}`}
            key={comment.id}
            className="scroll-mt-20 space-y-3 rounded-lg border border-base bg-inset p-4"
          >
            <header className="flex flex-wrap items-center gap-3">
              <Avatar
                src={comment.author?.avatarUrl ?? undefined}
                alt={comment.author?.displayName ?? copy.anonymous}
                fallback={comment.author?.username ?? "?"}
              />
              {comment.author ? (
                <Link
                  className="min-w-0 break-words text-sm font-semibold text-accent"
                  href={`/users/${encodeURIComponent(comment.author.username)}`}
                >
                  {comment.author.displayName} (@{comment.author.username})
                </Link>
              ) : (
                <span className="text-sm text-muted">{copy.anonymous}</span>
              )}
              <time dateTime={comment.createdAt} className="ml-auto text-xs text-muted">
                {new Date(comment.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
            </header>
            {comment.parentId && (
              <blockquote className="border-l-2 border-base pl-3 text-xs text-muted">
                <span>
                  {copy.parent}{" "}
                  {comment.parent?.username ? `@${comment.parent.username}` : copy.missingParent}
                </span>
                {comment.parent && <p className="mt-1 break-words">{comment.parent.text}</p>}
              </blockquote>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
              {comment.text}
            </p>
            <button
              className="text-xs text-accent underline"
              type="button"
              disabled={submitting}
              onClick={() => {
                setReply({
                  id: comment.id,
                  name: comment.author?.username ? `@${comment.author.username}` : copy.anonymous,
                });
                setPublished(false);
                textarea.current?.focus();
                textarea.current?.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
            >
              {copy.reply}
            </button>
          </article>
        ))}
      </div>
      {page && !page.items.length && <p className="text-sm text-muted">{copy.first}</p>}
      {readError && (
        <p role="alert" className="text-sm text-danger">
          {readError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {page?.hasMore && (
          <Button
            type="button"
            size="sm"
            isLoading={loading}
            disabled={submitting}
            onClick={() => void load(true)}
          >
            {loading ? copy.loading : copy.older}
          </Button>
        )}
        <button
          type="button"
          disabled={loading || submitting}
          className="text-sm text-accent underline"
          onClick={() => void load()}
        >
          {!page || readError ? copy.retry : copy.latest}
        </button>
      </div>
    </section>
  );
}
