"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@nexus/ui";
import {
  publicationPageSchema,
  PUBLICATION_TYPES,
  PUBLICATION_SOURCES,
  type PublicationPage,
  type PublicationQuery,
} from "../lib/publication-feed-contract";
import { publicationCopy, publicationError } from "../lib/publication-feed-copy";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
import type { Locale } from "../lib/i18n";
export function PublicationFeed({
  initial,
  filters,
  locale,
  path,
  apiPath,
  following = false,
}: {
  initial: PublicationPage | null;
  filters: PublicationQuery;
  locale: Locale;
  path: string;
  apiPath: string;
  following?: boolean;
}) {
  const copy = publicationCopy(locale),
    types = getUserPlatformCopy(locale);
  const [page, setPage] = useState(initial),
    [error, setError] = useState(initial ? "" : copy.error);
  const [pending, setPending] = useState(false),
    [history, setHistory] = useState<(string | null)[]>([]);
  const cursor = useRef<string | null>(null),
    busy = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function load(direction: "latest" | "next" | "previous") {
    if (
      busy.current ||
      (direction === "next" && !page?.nextCursor) ||
      (direction === "previous" && !history.length)
    )
      return;
    busy.current = true;
    setPending(true);
    setError("");
    const next =
      direction === "latest"
        ? null
        : direction === "next"
          ? (page?.nextCursor ?? null)
          : (history.at(-1) ?? null);
    const request = new AbortController();
    controller.current = request;
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.type) params.set("type", filters.type);
    if (following && filters.source) params.set("source", filters.source);
    if (next) params.set("cursor", next);
    try {
      const parsed = publicationPageSchema.safeParse(
        await platformRequest(
          `${apiPath}?${params}`,
          locale,
          "GET",
          undefined,
          request.signal,
          publicationError,
        ),
      );
      if (!parsed.success) throw new Error(copy.error);
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
      if (alive.current) setError(failure instanceof Error ? failure.message : copy.error);
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  const button =
    "min-h-11 rounded-lg border border-base px-3 text-sm font-semibold text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";
  const typeLabel = (type: (typeof PUBLICATION_TYPES)[number]) =>
    type === "review" ? (locale === "ru" ? "Обзор" : "Review") : types[type];
  return (
    <div className="space-y-5">
      <form action={path} method="get" className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-48 flex-1 space-y-1 text-xs text-secondary">
          {copy.query}
          <input
            className={platformFieldClass}
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filters.query}
          />
        </label>
        <label className="space-y-1 text-xs text-secondary">
          {copy.type}
          <select name="type" defaultValue={filters.type ?? ""} className={platformFieldClass}>
            <option value="">{copy.all}</option>
            {PUBLICATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        {following && (
          <label className="space-y-1 text-xs text-secondary">
            {copy.source}
            <select
              name="source"
              defaultValue={filters.source ?? ""}
              className={platformFieldClass}
            >
              <option value="">{copy.all}</option>
              {PUBLICATION_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {copy[source]}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className={button}>
          {copy.search}
        </button>
        <Link href={path} className="min-h-11 content-center text-sm text-accent underline">
          {copy.reset}
        </Link>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div aria-busy={pending} className="space-y-4">
        {page?.items.map((item) => (
          <article key={item.id} className="nexus-panel space-y-3 p-5">
            <header className="flex flex-wrap items-center gap-3">
              <Avatar
                src={item.author.avatar ?? undefined}
                alt={item.author.name}
                fallback={item.author.name}
              />
              <Link
                href={`/users/${encodeURIComponent(item.author.username)}`}
                className="break-words text-sm font-semibold text-accent"
              >
                {item.author.name} (@{item.author.username})
              </Link>
              <time dateTime={item.publishedAt} className="ml-auto text-xs text-muted">
                {new Date(item.publishedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
            </header>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <span>{typeLabel(item.type)}</span>
              {[item.organization, item.server, item.product].map(
                (context) =>
                  context && (
                    <Link
                      key={context.href}
                      href={context.href}
                      className="break-words text-accent underline"
                    >
                      {context.name}
                    </Link>
                  ),
              )}
            </div>
            <h2 className="break-words text-lg font-bold text-primary">
              <Link className="hover:underline" href={`/articles/${encodeURIComponent(item.slug)}`}>
                {item.title}
              </Link>
            </h2>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">{item.excerpt}</p>
            <Link
              href={`/articles/${encodeURIComponent(item.slug)}#discussion`}
              className="text-xs text-accent underline"
            >
              {copy.comments}: {item.commentCount}
            </Link>
          </article>
        ))}
        {page && !page.items.length && (
          <div className="nexus-panel space-y-3 p-8 text-center text-sm text-muted">
            <p>
              {filters.query || filters.type || filters.source ? copy.emptyFiltered : copy.empty}
            </p>
            {following && (
              <>
                <p>{copy.emptyFollowing}</p>
                <Link href="/discover" className="text-accent underline">
                  {copy.discover}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
      <nav aria-label={copy.activity} className="flex flex-wrap gap-3">
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() => void load("latest")}
        >
          {pending ? copy.loading : copy.latest}
        </button>
        {history.length > 0 && (
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => void load("previous")}
          >
            {copy.previous}
          </button>
        )}
        {page?.hasMore && (
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => void load("next")}
          >
            {copy.next}
          </button>
        )}
        {following && (
          <Link
            href="/workspace/saved"
            className="min-h-11 content-center text-sm text-accent underline"
          >
            {copy.manage}
          </Link>
        )}
      </nav>
    </div>
  );
}
