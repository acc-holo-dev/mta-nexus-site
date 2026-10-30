"use client";

import { Avatar, Button } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { submitContentCommentRequest } from "../lib/content-comment-client";
import { type DiscussionPage, discussionPageSchema } from "../lib/content-discussion-contract";
import { discussionError, getDiscussionCopy } from "../lib/content-discussion-copy";
import { ownDiscussionCopy } from "../lib/discussion-workspace-copy";
import { followCopy } from "../lib/follow-workspace-copy";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { platformFieldClass } from "../lib/user-platform-client";
import { CommunityReportForm } from "./community-report-form";
import { DiscussionCommentActions } from "./discussion-comment-actions";
import { FollowButton } from "./follow-button";

export function ContentDiscussion({
  slug,
  title,
  contentId,
  locale,
  count,
  initial,
  viewer = null,
  initialQuery = "",
  initialFocus,
  initialError = "",
}: {
  slug: string;
  title?: string;
  contentId: string;
  locale: Locale;
  count: number;
  initial: DiscussionPage | null;
  viewer?: { id: string; canModerate: boolean } | null;
  initialQuery?: string;
  initialFocus?: string;
  initialError?: string;
}) {
  const copy = getDiscussionCopy(locale);
  const [page, setPage] = useState<DiscussionPage | null>(initial);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(initialError || (initial ? "" : copy.unavailable));
  const [search, setSearch] = useState(initialQuery);
  const [focusedId, setFocusedId] = useState(initialFocus);
  const activeQuery = useRef(initialQuery);
  const readController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [writeError, setWriteError] = useState("");
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);
  const [displayCount, setDisplayCount] = useState(count);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [managementSuccess, setManagementSuccess] = useState("");
  const readGuard = useRef(false);
  const writeGuard = useRef(false);
  const managementGuard = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const path = `/api/content/${encodeURIComponent(slug)}/comments`;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      readController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (focusedId)
      document.getElementById(`comment-${focusedId}`)?.scrollIntoView({ block: "center" });
  }, [focusedId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Resolve legacy notification hashes once per mounted article; new links are loaded on the server.
  useEffect(() => {
    const navigate = () => {
      if (writeGuard.current) return;
      const match = /^#comment-([a-zA-Z0-9_-]{1,128})$/u.exec(window.location.hash);
      if (!match) return;
      if (document.getElementById(`comment-${match[1]}`)) setFocusedId(match[1]);
      else void load(false, "", match[1]);
    };
    if (!initialFocus) navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [slug]);
  async function load(older = false, query = activeQuery.current, focusId?: string) {
    if (readGuard.current || managementGuard.current || (older && !page?.nextCursor)) return;
    readGuard.current = true;
    setLoading(true);
    setReadError("");
    const cursor = older ? page?.nextCursor : null;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (focusId) params.set("comment", focusId);
    if (cursor) params.set("cursor", cursor);
    const controller = new AbortController();
    readController.current = controller;
    try {
      const response = await fetch(
        `${path}${params.size ? `?${params}` : ""}`,
        privateApiRequest({ timeoutMs: 15_000, signal: controller.signal }),
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
      if (focusId && parsed.data.items[0]?.id !== focusId) throw new Error(copy.focusMissing);
      if (!alive.current || controller.signal.aborted) return false;
      activeQuery.current = query;
      setSearch(query);
      if (!older) setFocusedId(focusId);
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
      if (alive.current && !controller.signal.aborted)
        setReadError(caught instanceof Error ? caught.message : copy.unavailable);
      return false;
    } finally {
      readGuard.current = false;
      if (alive.current && !controller.signal.aborted) setLoading(false);
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
      await load(false, "");
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      writeGuard.current = false;
      setSubmitting(false);
    }
  }
  return (
    <section id="discussion" className="nexus-panel space-y-5 p-5 sm:p-6">
      <div className="nexus-panel space-y-3 p-4">
        <p className="text-sm text-muted">{followCopy(locale).discussionHelp}</p>
        <FollowButton
          targetType="content"
          targetId={contentId}
          targetName={title ?? slug}
          locale={locale}
          initial={viewer ? undefined : { authenticated: false, following: false }}
        />
        <div className="flex flex-wrap gap-4">
          <Link
            href="/workspace/saved?type=content"
            className="inline-flex min-h-11 items-center text-xs text-accent underline"
          >
            {followCopy(locale).content}
          </Link>
          <Link
            href="/settings#notification-heading"
            className="inline-flex min-h-11 items-center text-xs text-accent underline"
          >
            {followCopy(locale).notificationSettings}
          </Link>
        </div>
      </div>

      {viewer && (
        <Link
          href="/workspace/discussions"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {ownDiscussionCopy(locale).title}
        </Link>
      )}
      <h2 className="font-heading text-primary">
        {copy.title} ({displayCount})
      </h2>
      <search aria-label={copy.search}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load(false, search.trim());
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="min-w-0 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.search}</span>
            <input
              type="search"
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={platformFieldClass}
              disabled={loading || submitting || !!managingId}
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={loading || submitting || !!managingId}
          >
            {copy.applySearch}
          </Button>
        </form>
      </search>
      <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
        {reply && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent-soft p-3 text-sm text-secondary">
            <span>
              {copy.replying} {reply.name}
            </span>
            <Button
              className="h-auto px-0 text-accent underline"
              variant="ghost"
              type="button"
              disabled={submitting}
              onClick={() => setReply(null)}
            >
              {copy.cancel}
            </Button>
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
            disabled={submitting || !!managingId}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            isLoading={submitting}
            disabled={text.trim().length < 2 || loading || !!managingId}
          >
            {submitting ? copy.publishing : copy.publish}
          </Button>
          <span className="text-xs text-muted">{text.length}/5000</span>
          {!viewer && (
            <Link className="text-xs text-accent underline" href="/auth/login">
              {copy.signIn}
            </Link>
          )}
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
      {managementSuccess && (
        <p role="status" className="text-sm text-accent">
          {managementSuccess}
        </p>
      )}
      <div className="space-y-3" aria-busy={loading}>
        {page?.items.map((comment) => (
          <article
            id={`comment-${comment.id}`}
            key={comment.id}
            aria-label={comment.id === focusedId ? copy.focused : undefined}
            className={`scroll-mt-20 space-y-3 rounded-lg border bg-inset p-4 ${comment.id === focusedId ? "border-[var(--nexus-accent)]" : "border-base"}`}
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
                <Link
                  className="text-accent underline"
                  href={`/articles/${encodeURIComponent(slug)}?comment=${encodeURIComponent(comment.parentId)}#comment-${encodeURIComponent(comment.parentId)}`}
                >
                  {copy.parent}{" "}
                  {comment.parent?.username ? `@${comment.parent.username}` : copy.missingParent}
                </Link>
                {comment.parent && <p className="mt-1 break-words">{comment.parent.text}</p>}
              </blockquote>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
              {comment.text}
            </p>
            <Link
              className="inline-flex min-h-11 items-center text-xs text-accent underline"
              href={`/articles/${encodeURIComponent(slug)}?comment=${encodeURIComponent(comment.id)}#comment-${encodeURIComponent(comment.id)}`}
            >
              {copy.permalink}
            </Link>
            {viewer?.id !== comment.author?.id && (
              <CommunityReportForm
                targetType="comment"
                targetId={comment.id}
                locale={locale}
                authenticated={!!viewer}
              />
            )}
            <Button
              className="h-auto px-0 text-xs text-accent underline"
              variant="ghost"
              type="button"
              disabled={submitting || !!managingId}
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
            </Button>
            {viewer &&
              comment.revision &&
              (viewer.id === comment.author?.id || viewer.canModerate) && (
                <DiscussionCommentActions
                  comment={comment}
                  own={viewer.id === comment.author?.id}
                  slug={slug}
                  contentId={contentId}
                  locale={locale}
                  disabled={loading || submitting || (!!managingId && managingId !== comment.id)}
                  onPending={(pending) => {
                    writeGuard.current = pending;
                    managementGuard.current = pending;
                    setManagingId(pending ? comment.id : null);
                    if (pending) setManagementSuccess("");
                  }}
                  onSaved={(value, revision) => {
                    setPage((current) =>
                      current
                        ? {
                            ...current,
                            items: current.items
                              .filter((item) => value !== undefined || item.id !== comment.id)
                              .map((item) =>
                                item.id === comment.id
                                  ? { ...item, text: value as string, revision }
                                  : item.parentId === comment.id
                                    ? {
                                        ...item,
                                        parent:
                                          value === undefined
                                            ? null
                                            : {
                                                text: value.slice(0, 160),
                                                username: comment.author?.username ?? null,
                                              },
                                      }
                                    : item,
                              ),
                          }
                        : current,
                    );
                    if (value === undefined) {
                      setDisplayCount((current) => Math.max(0, current - 1));
                      if (reply?.id === comment.id) setReply(null);
                    }
                    setManagementSuccess(value === undefined ? copy.removed : copy.edited);
                  }}
                />
              )}
          </article>
        ))}
      </div>
      {page && !page.items.length && (
        <p className="text-sm text-muted">{activeQuery.current ? copy.noMatches : copy.first}</p>
      )}
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
            disabled={submitting || !!managingId}
            onClick={() => void load(true)}
          >
            {loading ? copy.loading : copy.older}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={loading || submitting || !!managingId}
          className="h-auto px-0 text-sm text-accent underline"
          onClick={() => void load(false, "")}
        >
          {!page || readError ? copy.retry : copy.latest}
        </Button>
      </div>
    </section>
  );
}
