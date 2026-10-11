import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  authorPublicationDeskHref,
  parseAuthorPublicationDeskQuery,
} from "../../../lib/author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { authorContentService } from "../../../lib/services/author-content-service";
import { platformFieldClass } from "../../../lib/user-platform-client";
import { writerTypes } from "../../../lib/user-platform-contract";
import { getUserPlatformCopy } from "../../../lib/user-platform-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
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
} = {}) {
  const locale = await getRequestLocale(),
    copy = authorPublicationDeskCopy(locale),
    labels = getUserPlatformCopy(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
  const filters = parseAuthorPublicationDeskQuery(params);
  let error = filters ? "" : copy.invalid,
    signIn = false;
  const report = await (async () => {
    try {
      const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
      if (!actor) {
        signIn = true;
        return null;
      }
      return filters ? await authorContentService.desk(actor, filters) : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? authorPublicationDeskError(locale, failure.code)
          : copy.unavailable;
      return null;
    }
  })();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </div>
        <Link
          href="/workspace/content/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          {labels.create}
        </Link>
      </header>
      {signIn ? (
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {labels.signIn}
        </Link>
      ) : (
        <>
          <form
            action="/workspace/content"
            method="get"
            className="nexus-panel flex flex-wrap items-end gap-3 p-4"
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
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
            >
              {copy.search}
            </button>
            <Link
              href="/workspace/content"
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.reset}
            </Link>
          </form>
          <p className="text-xs text-muted">{copy.live}</p>
          <Link
            prefetch={false}
            href={filters ? authorPublicationDeskHref(filters) : "/workspace/content"}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.latest}
          </Link>
          {error && (
            <p role="alert" className="nexus-panel p-4 text-sm text-danger">
              {error}
            </p>
          )}
          {report && !report.items.length && (
            <p className="nexus-panel p-6 text-sm text-muted">{copy.empty}</p>
          )}
          <ul className="space-y-3">
            {filters &&
              report?.items.map((item) => (
                <li key={item.id}>
                  <article className="nexus-panel space-y-3 p-5">
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
                        {new Date(item.updatedAt).toLocaleString(
                          locale === "ru" ? "ru-RU" : "en-US",
                          { timeZone: "UTC" },
                        )}{" "}
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
                            className="inline-flex min-h-11 items-center break-words text-xs text-accent underline"
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
                          className="inline-flex min-h-11 items-center break-words text-xs text-accent underline"
                        >
                          #{tag}
                        </Link>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Link
                        prefetch={false}
                        href={`/workspace/content/${encodeURIComponent(item.id)}`}
                        className="inline-flex min-h-11 items-center text-sm text-accent underline"
                      >
                        {labels.edit}
                      </Link>
                      <Link
                        prefetch={false}
                        href={`/workspace/content/${encodeURIComponent(item.id)}/history`}
                        className="inline-flex min-h-11 items-center text-sm text-accent underline"
                      >
                        {copy.history}
                      </Link>
                      {item.status === "published" && (
                        <Link
                          prefetch={false}
                          href={`/articles/${encodeURIComponent(item.slug)}`}
                          className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
                  className="inline-flex min-h-11 items-center text-sm text-accent underline"
                >
                  {copy.newer}
                </Link>
              )}
              {report.olderCursor && (
                <Link
                  prefetch={false}
                  href={authorPublicationDeskHref(filters, report.olderCursor)}
                  className="inline-flex min-h-11 items-center text-sm text-accent underline"
                >
                  {copy.older}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
