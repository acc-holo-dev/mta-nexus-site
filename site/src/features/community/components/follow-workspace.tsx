"use client";
import { Avatar, Button, EmptyState, ErrorState } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { confirmAction } from "../../shell/confirm-action";
import {
  linkAccentSm,
  linkAccentXs,
  linkGhostAccentSm,
  linkMinHAccent,
  linkMinHAccentFocus,
} from "../../shell/link-shell";
import { pageShellStack5 } from "../../shell/page-shell";
import {
  typeFlexCenterBetweenGap3,
  typeFlexWrapCenterBetweenGap3,
  typeFlexWrapEndGap3,
  typeGridGap4Md2,
  typeMinFlex1,
  typeSmMuted,
  typeSmSuccess,
  typeSpace2SmMuted,
  typeXsFaint,
  typeXsMuted,
} from "../../shell/type-shell";
import { confirmsFollowMutation } from "../follow-confirmation";
import {
  FOLLOW_TYPES,
  type FollowPage,
  type FollowTargetType,
  followPageSchema,
} from "../follow-workspace-contract";
import { followCopy, followError } from "../follow-workspace-copy";
import { ObjectMuteControls } from "../object-mute-controls";
import { publicationHref } from "../publication-feed-contract";
import { publicationCopy } from "../publication-feed-copy";
import { platformRequest } from "../user-platform-client";
import { getUserPlatformCopy } from "../user-platform-copy";

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
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
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
      if (alive.current) setError(safeMessage(failure, copy.pageError));
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
      if (alive.current) setError(safeMessage(failure, copy.unconfirmed));
    } finally {
      busy.current = false;
      if (alive.current) setPending("");
    }
  }
  const Root = sectionLabelledBy ? "section" : "div";
  return (
    <Root
      {...(sectionLabelledBy ? { "aria-labelledby": sectionLabelledBy } : {})}
      className={pageShellStack5}
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
        <form action="/workspace/saved" method="get" className={typeFlexWrapEndGap3}>
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
          <Button type="submit" variant="outline" className={linkMinHAccentFocus}>
            {copy.submit}
          </Button>
          <Link href={href(type, "")} className={linkAccentSm}>
            {copy.clear}
          </Link>
          <Button
            type="button"
            variant="outline"
            disabled={!!pending}
            onClick={() => void load("latest")}
            className={linkMinHAccentFocus}
          >
            {pending === "latest" ? copy.refreshing : copy.latest}
          </Button>
        </form>
      </search>
      {error && (
        <ErrorState
          title={error}
          description={copy.pageErrorHint}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={!!pending}
              className={linkGhostAccentSm}
              onClick={() => void load("latest")}
            >
              {copy.retry}
            </Button>
          }
        />
      )}
      {success && (
        <p role="status" className={typeSmSuccess}>
          {success}
        </p>
      )}
      {page && !page.items.length && (
        <EmptyState
          title={type || query ? copy.emptyFiltered : copy.empty}
          description={type || query ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            type || query ? (
              <Link href={href(undefined, "")} className={linkAccentSm}>
                {copy.clear}
              </Link>
            ) : (
              <Link href="/discover" className={linkAccentSm}>
                {copy.discover}
              </Link>
            )
          }
        />
      )}
      <div aria-busy={!!pending} className={typeGridGap4Md2}>
        {page?.items.map((item) => (
          <article key={item.id} className="nexus-panel flex flex-col gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar
                src={item.image ?? undefined}
                alt={item.title ?? copy.unavailableTarget}
                fallback={item.title ?? "?"}
                size="md"
              />
              <div className={typeMinFlex1}>
                <p className={typeXsMuted}>{copy[item.targetType]}</p>
                <h2 className="flex gap-2 text-sm font-bold text-primary">
                  {item.href ? (
                    <Link
                      className="truncate rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      href={item.href}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <ErrorState
                      id="follow-unavailable-target"
                      title={copy.unavailableTarget}
                      description={copy.unavailableTargetHint}
                    />
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
              <p className={typeXsMuted}>
                {item.notifyComments ? copy.watchingDiscussion : copy.quietSaveHint}
              </p>
            )}
            {item.discussion && item.href && (
              <div className={typeSpace2SmMuted}>
                <p>
                  {copy.replies}: {item.discussion.replyCount}
                </p>
                {item.discussion.latestId && (
                  <Link
                    prefetch={false}
                    href={`${item.href}?comment=${encodeURIComponent(item.discussion.latestId)}#comment-${encodeURIComponent(item.discussion.latestId)}`}
                    className={linkAccentXs}
                  >
                    {copy.latestReply}
                  </Link>
                )}
              </div>
            )}
            {item.href ? (
              <ObjectMuteControls
                targetType={item.targetType}
                targetId={item.targetId}
                actorId={actorId}
                locale={locale}
                initial={{
                  muted: Boolean(item.mutedUntil),
                  mutedUntil: item.mutedUntil,
                }}
              />
            ) : null}
            <div className={typeFlexWrapCenterBetweenGap3}>
              {item.href && item.targetType === "product" && (
                <span className="space-y-1">
                  <Link
                    prefetch={false}
                    href={`/workspace/library/${encodeURIComponent(item.targetId)}/collections`}
                    className={linkAccentXs}
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
                  className={linkAccentXs}
                >
                  {publicationCopy(locale).targetFeed}
                </Link>
              )}
              <time dateTime={item.createdAt} className={typeXsFaint}>
                {copy.savedAt}:{" "}
                {new Date(item.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                })}
              </time>
              <Button
                type="button"
                variant="outline"
                className={linkMinHAccent}
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
        <nav aria-label={copy.page} className={typeFlexCenterBetweenGap3}>
          <Button
            type="button"
            variant="outline"
            className={linkMinHAccent}
            disabled={!!pending || !history.length}
            onClick={() => void load("previous")}
          >
            {copy.previous}
          </Button>
          <span className={typeSmMuted}>
            {copy.page} {history.length + 1}
          </span>
          <Button
            type="button"
            variant="outline"
            className={linkMinHAccent}
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
