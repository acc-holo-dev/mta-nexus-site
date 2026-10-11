import { Avatar } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import {
  PUBLICATION_SOURCES,
  PUBLICATION_TYPES,
  type PublicationPage,
  type PublicationQuery,
  publicationHref,
  SERVER_PUBLICATION_TYPES,
} from "../lib/publication-feed-contract";
import { publicationCopy, publicationError } from "../lib/publication-feed-copy";
import { platformFieldClass } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
export function PublicationFeed({
  initial,
  filters,
  locale,
  path,
  following = false,
  server = false,
  errorCode,
}: {
  initial: PublicationPage | null;
  filters: PublicationQuery;
  locale: Locale;
  path: string;
  following?: boolean;
  server?: boolean;
  errorCode?: string;
}) {
  const copy = publicationCopy(locale),
    types = getUserPlatformCopy(locale);
  const page = initial,
    error = initial ? "" : errorCode ? publicationError(locale, errorCode) : copy.error;
  const button =
    "min-h-11 rounded-lg border border-base px-3 text-sm font-semibold text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";
  const typeLabel = (type: (typeof PUBLICATION_TYPES)[number]) =>
    type === "review" ? (locale === "ru" ? "Обзор" : "Review") : types[type];
  return (
    <div className="space-y-5">
      {following && filters.target && (
        <p className="nexus-panel flex flex-wrap items-center gap-3 p-4 text-sm text-muted">
          <span>{copy.targetSelected}</span>
          <Link
            prefetch={false}
            href={publicationHref(path, { ...filters, target: undefined, cursor: undefined })}
            className="inline-flex min-h-11 items-center text-accent underline"
          >
            {copy.clearTarget}
          </Link>
        </p>
      )}
      <form action={path} method="get" className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        {following && filters.target && (
          <>
            <input type="hidden" name="target" value={filters.target} />
            <input type="hidden" name="source" value={filters.source} />
          </>
        )}
        <label className="min-w-48 flex-1 space-y-1 text-xs text-secondary">
          {copy.query}
          <input
            className={platformFieldClass}
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filters.query}
            placeholder={copy.queryHint}
          />
        </label>
        <label className="space-y-1 text-xs text-secondary">
          {copy.type}
          <select name="type" defaultValue={filters.type ?? ""} className={platformFieldClass}>
            <option value="">{copy.all}</option>
            {(server ? SERVER_PUBLICATION_TYPES : PUBLICATION_TYPES).map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        {following && !filters.target && (
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
        <label className="min-w-40 flex-1 space-y-1 text-xs text-secondary">
          {copy.author}
          <input
            className={platformFieldClass}
            name="author"
            maxLength={128}
            defaultValue={filters.author ?? ""}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label className="min-w-32 flex-1 space-y-1 text-xs text-secondary">
          {copy.tag}
          <input
            className={platformFieldClass}
            name="tag"
            maxLength={30}
            defaultValue={filters.tag ?? ""}
          />
        </label>
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
      <div className="space-y-4">
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
                prefetch={false}
                className="break-words text-sm font-semibold text-accent"
              >
                {item.author.name} (@{item.author.username})
              </Link>
              <Link
                href={publicationHref(path, { ...filters, author: item.author.username })}
                className="text-xs text-accent underline"
                prefetch={false}
              >
                {copy.onlyAuthor}
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
                      prefetch={false}
                      className="break-words text-accent underline"
                    >
                      {context.name}
                    </Link>
                  ),
              )}
            </div>
            <h2 className="break-words text-lg font-bold text-primary">
              <Link
                className="hover:underline"
                href={`/articles/${encodeURIComponent(item.slug)}`}
                prefetch={false}
              >
                {item.title}
              </Link>
            </h2>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">{item.excerpt}</p>
            {item.tags?.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label={copy.tag}>
                {Array.from(new Set(item.tags)).map((tag) => (
                  <li key={tag}>
                    <Link
                      href={publicationHref(path, { ...filters, tag })}
                      prefetch={false}
                      className="inline-flex min-h-8 items-center break-all rounded-md border border-base px-2 text-xs text-accent"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/articles/${encodeURIComponent(item.slug)}#discussion`}
              prefetch={false}
              className="text-xs text-accent underline"
            >
              {copy.comments}: {item.commentCount}
            </Link>
          </article>
        ))}
        {page && !page.items.length && (
          <div className="nexus-panel space-y-3 p-8 text-center text-sm text-muted">
            <p>
              {filters.target && !filters.cursor
                ? copy.emptyTarget
                : filters.cursor
                  ? copy.emptyPage
                  : filters.query || filters.type || filters.source || filters.author || filters.tag
                    ? copy.emptyFiltered
                    : copy.empty}
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
        {page?.previousCursor && (
          <Link
            href={publicationHref(path, filters, page.previousCursor)}
            className={`${button} inline-flex items-center`}
            prefetch={false}
          >
            {copy.previous}
          </Link>
        )}
        <a href={publicationHref(path, filters)} className={`${button} inline-flex items-center`}>
          {copy.latest}
        </a>
        {error && (
          <a
            href={publicationHref(
              path,
              filters,
              filters.cursor ? JSON.stringify(filters.cursor) : null,
            )}
            className={`${button} inline-flex items-center`}
          >
            {copy.retry}
          </a>
        )}
        {page?.hasMore && (
          <Link
            href={publicationHref(path, filters, page.nextCursor)}
            className={`${button} inline-flex items-center`}
            prefetch={false}
          >
            {copy.next}
          </Link>
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
