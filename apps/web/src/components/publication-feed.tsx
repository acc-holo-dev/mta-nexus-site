import { Avatar, Button, ErrorState, SearchField } from "@nexus/ui";
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
  sectionLabelledBy,
}: {
  initial: PublicationPage | null;
  filters: PublicationQuery;
  locale: Locale;
  path: string;
  following?: boolean;
  server?: boolean;
  errorCode?: string;
  sectionLabelledBy?: string;
}) {
  const copy = publicationCopy(locale),
    types = getUserPlatformCopy(locale);
  const page = initial,
    error = initial ? "" : errorCode ? publicationError(locale, errorCode) : copy.error;
  const filtered = Boolean(
    filters.query || filters.type || filters.source || filters.author || filters.tag,
  );
  const emptyFollowingHonest = following && !filters.target && !filters.cursor && !filtered;
  const linkControl =
    "min-h-11 rounded-lg border border-base px-3 text-sm font-semibold text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";
  const typeLabel = (type: (typeof PUBLICATION_TYPES)[number]) => types[type];
  const Root = sectionLabelledBy ? "section" : "div";
  return (
    <Root
      {...(sectionLabelledBy ? { "aria-labelledby": sectionLabelledBy } : {})}
      className="space-y-5"
    >
      {following && filters.target && (
        <p className="nexus-panel flex flex-wrap items-center gap-3 p-4 text-sm text-muted">
          <span>{copy.targetSelected}</span>
          <Link
            prefetch={false}
            href={publicationHref(path, { ...filters, target: undefined, cursor: undefined })}
            className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
        <div className="min-w-48 flex-1">
          <SearchField
            className={platformFieldClass}
            label={copy.query}
            name="q"
            maxLength={100}
            defaultValue={filters.query}
            placeholder={copy.queryHint}
          />
        </div>
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
        <Button type="submit" variant="outline" className="min-h-11 font-semibold text-accent">
          {copy.search}
        </Button>
        <Link
          href={path}
          className="min-h-11 content-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.reset}
        </Link>
      </form>
      {error && (
        <ErrorState
          title={error}
          action={
            <a
              href={publicationHref(
                path,
                filters,
                filters.cursor ? JSON.stringify(filters.cursor) : null,
              )}
              className={`${linkControl} inline-flex items-center`}
            >
              {copy.retry}
            </a>
          }
        />
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
                className="break-words text-sm font-semibold text-accent rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {item.author.name} (@{item.author.username})
              </Link>
              <Link
                href={publicationHref(path, { ...filters, author: item.author.username })}
                className="rounded text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                      className="break-words rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                      className="inline-flex min-h-8 items-center break-all rounded-md border border-base px-2 text-xs text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
              className="rounded text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                  : emptyFollowingHonest
                    ? copy.emptyFollowing
                    : filtered
                      ? copy.emptyFiltered
                      : copy.empty}
            </p>
            {filters.target && !filters.cursor && (
              <Link
                prefetch={false}
                href={publicationHref(path, {
                  ...filters,
                  target: undefined,
                  cursor: undefined,
                })}
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.clearTarget}
              </Link>
            )}
            {filtered && !filters.cursor && (
              <Link
                prefetch={false}
                href={publicationHref(path, {
                  ...filters,
                  query: "",
                  type: undefined,
                  source: undefined,
                  author: undefined,
                  tag: undefined,
                  cursor: undefined,
                })}
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.reset}
              </Link>
            )}
            {filters.cursor && (
              <Link
                prefetch={false}
                href={publicationHref(path, { ...filters, cursor: undefined })}
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.latest}
              </Link>
            )}
            {emptyFollowingHonest && (
              <Link
                href="/discover"
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.discover}
              </Link>
            )}
          </div>
        )}
      </div>
      <nav aria-label={copy.activity} className="flex flex-wrap gap-3">
        {page?.previousCursor && (
          <Link
            href={publicationHref(path, filters, page.previousCursor)}
            className={`${linkControl} inline-flex items-center`}
            prefetch={false}
          >
            {copy.previous}
          </Link>
        )}
        <a
          href={publicationHref(path, filters)}
          className={`${linkControl} inline-flex items-center`}
        >
          {copy.latest}
        </a>
        {page?.hasMore && (
          <Link
            href={publicationHref(path, filters, page.nextCursor)}
            className={`${linkControl} inline-flex items-center`}
            prefetch={false}
          >
            {copy.next}
          </Link>
        )}
        {following && (
          <Link
            href="/workspace/saved"
            className="min-h-11 content-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.manage}
          </Link>
        )}
      </nav>
    </Root>
  );
}
