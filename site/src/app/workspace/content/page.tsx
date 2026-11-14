import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { platformSignInFocusClass } from "../../../components/guest-auth-links";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  authorPublicationDeskHref,
  parseAuthorPublicationDeskQuery,
} from "../../../lib/author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../../../lib/author-publication-desk-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { authorContentService } from "../../../lib/services/author-content-service";
import { platformFieldClass } from "../../../lib/user-platform-client";
import { writerTypes } from "../../../lib/user-platform-contract";
import { getUserPlatformCopy } from "../../../lib/user-platform-copy";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata(): Promise<Metadata> {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function AuthorContentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = authorPublicationDeskCopy(locale),
    dictionary = getDictionary(locale),
    labels = getUserPlatformCopy(locale),
    rawSearchParams = (await searchParams) ?? {},
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
  const filters = parseAuthorPublicationDeskQuery(params);
  const returnPath = params.size ? `/workspace/content?${params}` : "/workspace/content";
  const sessionActor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!sessionActor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let error = filters ? "" : copy.invalid;
  const report = await (async () => {
    try {
      const actor = sessionActor;
      return filters ? await authorContentService.desk(actor, filters) : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? authorPublicationDeskError(locale, failure.code)
          : copy.unavailable;
      return null;
    }
  })();
  const filteredEmpty = Boolean(
    filters?.cursor ||
      filters?.query ||
      filters?.tag ||
      filters?.status !== "all" ||
      filters?.type !== "all" ||
      filters?.source !== "all",
  );
  const retryHref = filters ? returnPath : "/workspace/content";
  return (
    <div className={pageShellClass}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </div>
        <Link
          href="/workspace/content/new"
          className={`inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white ${platformSignInFocusClass}`}
        >
          {labels.create}
        </Link>
      </header>
      <search aria-label={copy.filters}>
        <form
          action="/workspace/content"
          method="get"
          className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
        >
          <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters?.query ?? ""}
              className={`${platformFieldClass} block min-h-11`}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            {labels.status}
            <select
              name="status"
              defaultValue={filters?.status ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              {(["all", "draft", "published", "archived"] as const).map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            {labels.type}
            <select
              name="type"
              defaultValue={filters?.type ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              <option value="all">{copy.all}</option>
              {writerTypes.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.source}
            <select
              name="source"
              defaultValue={filters?.source ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              {(["all", "personal", "organization", "server"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.tag}
            <input
              name="tag"
              maxLength={30}
              defaultValue={filters?.tag ?? ""}
              className={`${platformFieldClass} block min-h-11`}
            />
          </label>
          <Button type="submit" className="min-h-11 font-semibold">
            {copy.search}
          </Button>
          <Link href="/workspace/content" className={navLinkClass}>
            {copy.reset}
          </Link>
        </form>
      </search>
      <p className="text-xs text-muted">{copy.live}</p>
      <Link
        prefetch={false}
        href={filters ? authorPublicationDeskHref(filters) : "/workspace/content"}
        className={navLinkClass}
      >
        {copy.latest}
      </Link>
      {error && (
        <ErrorState
          title={error}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      )}
      {report && !report.items.length && (
        <EmptyState
          title={filteredEmpty ? copy.emptyFiltered : copy.empty}
          description={filteredEmpty ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            filteredEmpty ? (
              <Link href="/workspace/content" className={navLinkClass}>
                {copy.reset}
              </Link>
            ) : (
              <Link
                href="/workspace/content/new"
                className={`inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white ${platformSignInFocusClass}`}
              >
                {labels.create}
              </Link>
            )
          }
        />
      )}
      <ul className="min-w-0 space-y-3">
        {filters &&
          report?.items.map((item) => (
            <li key={item.id}>
              <article className="nexus-panel min-w-0 space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words font-semibold text-primary">
                    <Link
                      prefetch={false}
                      href={`/workspace/content/${encodeURIComponent(item.id)}`}
                    >
                      {item.title}
                    </Link>
                  </h2>
                  <span className="text-xs text-muted">{labels[item.status]}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {item.excerpt}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{labels[item.type]}</span>
                  <span>{copy[item.source]}</span>
                  <time dateTime={item.updatedAt}>
                    {new Date(item.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  <span>
                    {labels.comments}: {item.commentCount}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[item.organization, item.server].map((context) =>
                    context ? (
                      <Link
                        key={context.href}
                        prefetch={false}
                        href={context.href}
                        className="inline-flex min-h-11 items-center break-words text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      >
                        {context.name}
                      </Link>
                    ) : null,
                  )}
                  {Array.from(new Set(item.tags)).map((tag) => (
                    <Link
                      key={tag}
                      prefetch={false}
                      href={authorPublicationDeskHref({ ...filters, tag, cursor: undefined })}
                      className="inline-flex min-h-11 items-center break-words text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link
                    prefetch={false}
                    href={`/workspace/content/${encodeURIComponent(item.id)}`}
                    className={navLinkClass}
                  >
                    {labels.edit}
                  </Link>
                  <Link
                    prefetch={false}
                    href={`/workspace/content/${encodeURIComponent(item.id)}/history`}
                    className={navLinkClass}
                  >
                    {copy.history}
                  </Link>
                  {item.status === "published" && (
                    <Link
                      prefetch={false}
                      href={`/articles/${encodeURIComponent(item.slug)}`}
                      className={navLinkClass}
                    >
                      {labels.publicView}
                    </Link>
                  )}
                </div>
              </article>
            </li>
          ))}
      </ul>
      {report && filters && (
        <nav aria-label={copy.title} className="flex flex-wrap gap-4">
          {report.newerCursor && (
            <Link
              prefetch={false}
              href={authorPublicationDeskHref(filters, report.newerCursor)}
              className={navLinkClass}
            >
              {copy.newer}
            </Link>
          )}
          {report.olderCursor && (
            <Link
              prefetch={false}
              href={authorPublicationDeskHref(filters, report.olderCursor)}
              className={navLinkClass}
            >
              {copy.older}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
