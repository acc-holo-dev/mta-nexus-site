"use client";

import { Avatar, Button } from "@nexus/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  ContentCommentSubmitError,
  createCommentIntentKey,
  submitContentCommentRequest,
} from "../lib/content-comment-client";
import { type DiscussionPage, discussionPageSchema } from "../lib/content-discussion-contract";
import {
  discussionError,
  discussionWriteNeedsSignIn,
  getDiscussionCopy,
} from "../lib/content-discussion-copy";
import {
  clearDiscussionComposeDraft,
  readDiscussionComposeDraft,
  writeDiscussionComposeDraft,
} from "../lib/discussion-compose-draft";
import { ownDiscussionCopy } from "../lib/discussion-workspace-copy";
import { followCopy } from "../lib/follow-workspace-copy";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { platformFieldClass } from "../lib/user-platform-client";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { CommunityReportForm } from "./community-report-form";
import { DiscussionComposeWriteFeedback } from "./content-discussion-compose-feedback";
import { ContentFollowControls } from "./content-follow-controls";
import { DiscussionCommentActions } from "./discussion-comment-actions";

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
  const pathname = usePathname();
  const [page, setPage] = useState<DiscussionPage | null>(initial);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(initialError || (initial ? "" : copy.unavailable));
  const [search, setSearch] = useState(initialQuery);
  const [focusedId, setFocusedId] = useState(initialFocus);
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const activeQuery = useRef(initialQuery);
  const readController = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [writeError, setWriteError] = useState("");
  const [writeNeedsSignIn, setWriteNeedsSignIn] = useState(false);
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
  const pendingIntent = useRef<{
    key: string;
    text: string;
    parentId?: string;
  } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const draftRestored = useRef(false);
  const path = `/api/content/${encodeURIComponent(slug)}/comments`;
  function persistComposeDraft(nextText = text, nextReply = reply) {
    const normalized = nextText.trimEnd();
    if (normalized.length < 1) {
      clearDiscussionComposeDraft(contentId);
      return;
    }
    writeDiscussionComposeDraft({
      contentId,
      text: normalized.slice(0, 5000),
      ...(nextReply
        ? { parentId: nextReply.id, parentName: nextReply.name }
        : { parentId: undefined, parentName: undefined }),
    });
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
  }, [pathname]);
  useEffect(() => {
    alive.current = true;
    if (!draftRestored.current) {
      draftRestored.current = true;
      const stored = readDiscussionComposeDraft(contentId);
      if (stored) {
        setText(stored.text);
        setReply(
          stored.parentId
            ? { id: stored.parentId, name: stored.parentName ?? copy.anonymous }
            : null,
        );
      }
    }
    return () => {
      alive.current = false;
      readController.current?.abort();
    };
  }, [contentId, copy.anonymous]);
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
      if (alive.current && !controller.signal.aborted) {
        setReadError(caught instanceof Error ? caught.message : copy.unavailable);
        if (focusId) setFocusedId(focusId);
      }
      return false;
    } finally {
      readGuard.current = false;
      if (alive.current && !controller.signal.aborted) setLoading(false);
    }
  }
  function returnToDiscussion() {
    setFocusedId(undefined);
    if (typeof window !== "undefined" && window.location.hash.startsWith("#comment-")) {
      const url = new URL(window.location.href);
      url.hash = "discussion";
      url.searchParams.delete("comment");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    void load(false, activeQuery.current);
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
    setWriteNeedsSignIn(false);
    setPublished(false);
    const parentId = reply?.id;
    const frozen =
      pendingIntent.current &&
      pendingIntent.current.text === normalized &&
      pendingIntent.current.parentId === parentId
        ? pendingIntent.current
        : { key: createCommentIntentKey(), text: normalized, parentId };
    pendingIntent.current = frozen;
    try {
      await submitContentCommentRequest({
        slug,
        contentId,
        parentId,
        text: normalized,
        intentKey: frozen.key,
        locale,
        fallbackError: copy.writeUnavailable,
      });
      pendingIntent.current = null;
      clearDiscussionComposeDraft(contentId);
      setText("");
      setReply(null);
      setPublished(true);
      setDisplayCount((current) => current + 1);
      // Saved state is independent from a subsequent read failure.
      await load(false, "");
    } catch (caught) {
      // Keep draft + frozen intent so a lost-response retry reuses one key.
      // Guest 401 / auth return must keep text for the author without auto-publish.
      persistComposeDraft(normalized, reply);
      setWriteError(caught instanceof Error ? caught.message : copy.unavailable);
      setWriteNeedsSignIn(
        caught instanceof ContentCommentSubmitError && discussionWriteNeedsSignIn(caught.code),
      );
    } finally {
      writeGuard.current = false;
      setSubmitting(false);
    }
  }
  return (
    <section id="discussion" className="nexus-panel space-y-5 p-5 sm:p-6">
      <div className="nexus-panel space-y-3 p-4">
        <ContentFollowControls
          contentId={contentId}
          title={title ?? slug}
          locale={locale}
          initial={
            viewer
              ? undefined
              : {
                  authenticated: false,
                  following: false,
                  notifyComments: false,
                  muted: false,
                  mutedUntil: null,
                }
          }
        />
        <div className="flex flex-wrap gap-4">
          <Link
            href="/workspace/saved?type=content"
            className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {followCopy(locale).content}
          </Link>
          <Link
            href="/settings#notification-heading"
            className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {followCopy(locale).notificationSettings}
          </Link>
        </div>
      </div>

      {viewer && (
        <Link
          href="/workspace/discussions"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
            // Search refreshes the list only; the compose draft stays in React state.
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
        {text.trim().length > 0 && (
          <p className="mt-2 text-xs text-muted">{copy.searchKeepsDraft}</p>
        )}
      </search>
      <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
        {reply && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent-soft p-3 text-sm text-secondary">
            <span>
              {copy.replying} {reply.name}
            </span>
            <Button
              className="h-auto px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              variant="ghost"
              type="button"
              disabled={submitting}
              onClick={() => {
                setReply(null);
                persistComposeDraft(text, null);
              }}
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
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              persistComposeDraft(next, reply);
            }}
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
            <Link
              className="text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              href={loginHref}
              onClick={() => persistComposeDraft()}
            >
              {copy.signIn}
            </Link>
          )}
        </div>
        <DiscussionComposeWriteFeedback
          error={writeError}
          needsSignIn={writeNeedsSignIn}
          loginHref={loginHref}
          signInLabel={copy.signIn}
          onPersistDraft={() => persistComposeDraft()}
        />
        {published && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.saved}
          </p>
        )}
      </form>
      {managementSuccess && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {managementSuccess}
        </p>
      )}
      <div className="space-y-3" aria-busy={loading}>
        {loading && !page?.items.length ? (
          <p role="status" aria-live="polite" className="text-sm text-muted">
            {copy.loading}
          </p>
        ) : null}
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
                  className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
              className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
              className="h-auto px-0 text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              variant="ghost"
              type="button"
              disabled={submitting || !!managingId}
              onClick={() => {
                const nextReply = {
                  id: comment.id,
                  name: comment.author?.username ? `@${comment.author.username}` : copy.anonymous,
                };
                setReply(nextReply);
                setPublished(false);
                persistComposeDraft(text, nextReply);
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
                    const ownRemoval = viewer.id === comment.author?.id;
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
                    setManagementSuccess(
                      value === undefined
                        ? ownRemoval
                          ? copy.removed
                          : copy.moderatedRemoved
                        : copy.edited,
                    );
                  }}
                />
              )}
          </article>
        ))}
      </div>
      {page && !page.items.length && (
        <div className="space-y-3 text-sm text-muted">
          <p>{activeQuery.current ? copy.noMatches : copy.first}</p>
          {activeQuery.current ? (
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              disabled={loading || submitting || !!managingId}
              onClick={() => {
                setSearch("");
                void load(false, "");
              }}
            >
              {copy.clearSearch}
            </Button>
          ) : null}
        </div>
      )}
      {readError && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-danger">
            {readError}
          </p>
          {(readError === copy.focusMissing || focusedId) && (
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              disabled={loading || submitting || !!managingId}
              onClick={returnToDiscussion}
            >
              {copy.returnDiscussion}
            </Button>
          )}
        </div>
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
          className="h-auto px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          onClick={() => void load(false, "")}
        >
          {!page || readError ? copy.retry : copy.latest}
        </Button>
      </div>
    </section>
  );
}
