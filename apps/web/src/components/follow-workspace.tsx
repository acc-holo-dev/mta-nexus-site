"use client";
import { Avatar, Button, EmptyState, ErrorState } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { confirmsFollowMutation } from "../lib/follow-confirmation";
import {
  FOLLOW_TYPES,
  type FollowPage,
  type FollowTargetType,
  followPageSchema,
} from "../lib/follow-workspace-contract";
import { followCopy, followError } from "../lib/follow-workspace-copy";
import type { Locale } from "../lib/i18n";
import { publicationHref } from "../lib/publication-feed-contract";
import { publicationCopy } from "../lib/publication-feed-copy";
import { platformRequest } from "../lib/user-platform-client";
import { confirmAction } from "./confirm-action";

const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function FollowWorkspace({
  initial,
  actorId,
  type,
  query,
  locale,
  sectionLabelledBy,
}: {
  initial: FollowPage | null;
  actorId: string;
  type?: FollowTargetType;
  query: string;
  locale: Locale;
  sectionLabelledBy?: string;
}) {
  const copy = followCopy(locale);
  const [page, setPage] = useState(initial);
  const [error, setError] = useState(initial ? "" : copy.pageError);
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState("");
  const busy = useRef(false);
  const cursor = useRef<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const href = (selected?: FollowTargetType, search = query) => {
    const params = new URLSearchParams();
    if (selected) params.set("type", selected);
    if (search) params.set("q", search);
    return `/workspace/saved${params.size ? `?${params}` : ""}`;
  };
  async function load(direction: "latest" | "next" | "previous") {
    if (
      busy.current ||
      (direction === "next" && !page?.nextCursor) ||
      (direction === "previous" && !history.length)
    )
      return;
    busy.current = true;
    setPending(direction);
    setError("");
    setSuccess("");
    const next =
      direction === "latest"
        ? null
        : direction === "next"
          ? (page?.nextCursor ?? null)
          : (history.at(-1) ?? null);
    const request = new AbortController();
    controller.current = request;
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (query) params.set("q", query);
    if (next) params.set("cursor", next);
    try {
      const data = await platformRequest(
        `/api/workspace/follows?${params}`,
        locale,
        "GET",
        undefined,
        request.signal,
        followError,
      );
      if (data?.actorId !== actorId) throw new Error(copy.unconfirmed);
      const parsed = followPageSchema.safeParse(data);
      if (!parsed.success) throw new Error(copy.unconfirmed);
      if (!alive.current) return;
      setHistory(
        direction === "latest"
          ? []
          : direction === "previous"
            ? history.slice(0, -1)
            : [...history, cursor.current],
      );
      cursor.current = next;
      setPage(parsed.data);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : copy.pageError);
    } finally {
      busy.current = false;
      if (alive.current) setPending("");
    }
  }
  async function remove(item: FollowPage["items"][number]) {
    if (busy.current) return;
    const objectLabel = item.title ?? copy.unavailableTarget;
    if (
      !(await confirmAction({
        title: copy.removeConfirmTitle,
        object: objectLabel,
        consequences: copy.removeConfirm,
        confirmLabel: copy.remove,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
      }))
    )
      return;
    busy.current = true;
    setPending(item.id);
    setError("");
    setSuccess("");
    const request = new AbortController();
    controller.current = request;
    try {
      const data = await platformRequest(
        "/api/follow",
        locale,
        "DELETE",
        { targetType: item.targetType, targetId: item.targetId, expectedActorId: actorId },
        request.signal,
        followError,
      );
      if (!confirmsFollowMutation(200, data, item.targetType, item.targetId, false))
        throw new Error(copy.unconfirmed);
      if (!alive.current) return;
      setPage((current) =>
        current
          ? { ...current, items: current.items.filter((value) => value.id !== item.id) }
          : current,
      );
      setSuccess(copy.removed);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : copy.unconfirmed);
    } finally {
      busy.current = false;
      if (alive.current) setPending("");
    }
  }
  const Root = sectionLabelledBy ? "section" : "div";
  return (
    <Root
      {...(sectionLabelledBy ? { "aria-labelledby": sectionLabelledBy } : {})}
      className="min-w-0 space-y-5 overflow-x-clip"
    >
      <nav aria-label={copy.title} className="flex min-w-0 gap-2 overflow-x-auto">
        {[undefined, ...FOLLOW_TYPES].map((value) => (
          <Link
            key={value ?? "all"}
            href={href(value)}
            aria-current={type === value ? "page" : undefined}
            className={`min-h-11 whitespace-nowrap rounded-lg border px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] ${type === value ? "border-accent text-accent" : "border-base text-secondary"}`}
          >
            {value ? copy[value] : copy.all}
          </Link>
        ))}
      </nav>
      <search aria-label={copy.search}>
        <form action="/workspace/saved" method="get" className="flex flex-wrap items-end gap-3">
          {type && <input name="type" type="hidden" value={type} />}
          <label className="min-w-48 flex-1 space-y-1 text-xs text-secondary">
            {copy.search}
            <input
              name="q"
              type="search"
              maxLength={100}
              defaultValue={query}
              className="min-h-11 w-full rounded-lg border border-base bg-inset px-3 text-sm text-primary"
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            className="min-h-11 text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.submit}
          </Button>
          <Link href={href(type, "")} className={actionLinkClass}>
            {copy.clear}
          </Link>
          <Button
            type="button"
            variant="outline"
            disabled={!!pending}
            onClick={() => void load("latest")}
            className="min-h-11 text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {pending === "latest" ? copy.refreshing : copy.latest}
          </Button>
        </form>
      </search>
      {error && (
        <ErrorState
          title={error}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={!!pending}
              className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              onClick={() => void load("latest")}
            >
              {copy.retry}
            </Button>
          }
        />
      )}
      {success && (
        <p role="status" className="text-sm text-success">
          {success}
        </p>
      )}
      {page && !page.items.length && (
        <EmptyState
          title={type || query ? copy.emptyFiltered : copy.empty}
          description={type || query ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            type || query ? (
              <Link href={href(undefined, "")} className={actionLinkClass}>
                {copy.clear}
              </Link>
            ) : (
              <Link href="/discover" className={actionLinkClass}>
                {copy.discover}
              </Link>
            )
          }
        />
      )}
      <div aria-busy={!!pending} className="grid gap-4 md:grid-cols-2">
        {page?.items.map((item) => (
          <article key={item.id} className="nexus-panel flex flex-col gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar
                src={item.image ?? undefined}
                alt={item.title ?? copy.unavailableTarget}
                fallback={item.title ?? "?"}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{copy[item.targetType]}</p>
                <h2 className="flex gap-2 text-sm font-bold text-primary">
                  {item.href ? (
                    <Link
                      className="truncate rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      href={item.href}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <ErrorState id="follow-unavailable-target" title={copy.unavailableTarget} />
                  )}
                  {item.verified && (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  )}
                </h2>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{item.description}</p>
                )}
              </div>
            </div>
            {item.targetType === "content" && (
              <p className="text-xs text-muted">
                {item.notifyComments ? copy.watchingDiscussion : copy.quietSaveHint}
              </p>
            )}
            {item.discussion && item.href && (
              <div className="space-y-2 text-sm text-muted">
                <p>
                  {copy.replies}: {item.discussion.replyCount}
                </p>
                {item.discussion.latestId && (
                  <Link
                    prefetch={false}
                    href={`${item.href}?comment=${encodeURIComponent(item.discussion.latestId)}#comment-${encodeURIComponent(item.discussion.latestId)}`}
                    className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.latestReply}
                  </Link>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {item.href && item.targetType === "product" && (
                <span className="space-y-1">
                  <Link
                    prefetch={false}
                    href={`/workspace/library/${encodeURIComponent(item.targetId)}/collections`}
                    className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    title={copy.toCollectionHint}
                  >
                    {copy.toCollection}
                  </Link>
                </span>
              )}
              {item.href && item.targetType !== "product" && item.targetType !== "content" && (
                <Link
                  prefetch={false}
                  href={publicationHref("/workspace/feed", {
                    query: "",
                    type: undefined,
                    source: item.targetType,
                    target: item.targetId,
                    cursor: undefined,
                  })}
                  className="inline-flex min-h-11 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {publicationCopy(locale).targetFeed}
                </Link>
              )}
              <time dateTime={item.createdAt} className="text-xs text-faint">
                {copy.savedAt}:{" "}
                {new Date(item.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                })}
              </time>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 text-accent"
                disabled={!!pending}
                onClick={() => void remove(item)}
                aria-label={`${copy.remove}: ${item.title ?? copy.unavailableTarget}`}
              >
                {pending === item.id ? copy.removing : copy.remove}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {page && (
        <nav aria-label={copy.page} className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 text-accent"
            disabled={!!pending || !history.length}
            onClick={() => void load("previous")}
          >
            {copy.previous}
          </Button>
          <span className="text-sm text-muted">
            {copy.page} {history.length + 1}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 text-accent"
            disabled={!!pending || !page.hasMore}
            onClick={() => void load("next")}
          >
            {pending === "next" ? copy.loading : copy.older}
          </Button>
        </nav>
      )}
    </Root>
  );
}
