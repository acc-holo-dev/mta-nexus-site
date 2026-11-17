import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ContentCatalogControls,
  ContentPageNavigation,
} from "../../../../../features/community/catalog-controls";
import {
  contentPageFiltered,
  parseContentPage,
  writerTypes,
} from "../../../../../features/community/user-platform-contract";
import {
  getUserPlatformCopy,
  userPlatformError,
} from "../../../../../features/community/user-platform-copy";
import { serverContentId } from "../../../../../features/servers/server-content-api";
import { serverContentCopy } from "../../../../../features/servers/server-content-copy";
import { serverPublicationHistoryCopy } from "../../../../../features/servers/server-publication-history-copy";
import { PlatformSignIn } from "../../../../../features/shell/guest-auth";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { serverContentService } from "../../../../../lib/services/servers/server-content-service";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  return {
    title: serverContentCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function ServerPublications({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = serverContentCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const { id } = await params;
  const path = `/workspace/servers/${encodeURIComponent(id)}/content`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  const filters = parseContentPage((await searchParams) ?? {});
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(() => serverContentService.page(serverContentId(id), actor, filters))
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? userPlatformError(locale, error.code) : copy.unavailable;
      return null;
    });
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/servers/${encodeURIComponent(id)}`} className={navLinkClass}>
        {team.back}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-primary">
            {team.title}
            {result ? `: ${result.server.name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted">{team.description}</p>
          <p className="mt-2 text-sm text-muted">{team.notice}</p>
        </div>
        {result && (
          <Link
            href={`${path}/new`}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {team.new}
          </Link>
        )}
      </header>
      {!result ? (
        <ErrorState
          title={failure}
          action={
            <Link href={path} className={navLinkClass}>
              {copy.retry}
            </Link>
          }
        />
      ) : (
        <>
          <ContentCatalogControls
            path={path}
            filters={filters}
            locale={locale}
            types={writerTypes}
            showStatus
          />
          {result.items.length ? (
            <div className="space-y-3">
              {result.items.map((item) => (
                <article
                  key={item.id}
                  className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="break-words font-heading text-primary">
                      <Link
                        href={`${path}/${encodeURIComponent(item.id)}`}
                        className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <span className="text-xs text-secondary">
                      {copy[item.status as "draft" | "published" | "archived"]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{item.excerpt}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <span>
                      {team.author}: {item.authorName ?? item.authorUsername ?? item.authorId}
                    </span>
                    <time dateTime={item.updatedAt}>
                      {copy.updated}:{" "}
                      {new Date(item.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                    </time>
                    <span>
                      {copy.comments}: {item.commentCount}
                    </span>
                    <Link href={`${path}/${encodeURIComponent(item.id)}`} className={navLinkClass}>
                      {copy.edit}
                    </Link>
                    <Link
                      href={`${path}/${encodeURIComponent(item.id)}/history`}
                      className={navLinkClass}
                    >
                      {serverPublicationHistoryCopy(locale).history}
                    </Link>
                    {item.status === "published" && (
                      <Link
                        href={`/articles/${encodeURIComponent(item.slug)}`}
                        className={navLinkClass}
                      >
                        {copy.publicView}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={contentPageFiltered(filters) ? copy.emptyFiltered : copy.empty}
              description={contentPageFiltered(filters) ? team.emptyFilteredHint : team.emptyHint}
              action={
                contentPageFiltered(filters) ? (
                  <Link href={path} className={navLinkClass}>
                    {copy.reset}
                  </Link>
                ) : (
                  <Link href={`${path}/new`} className={navLinkClass}>
                    {team.new}
                  </Link>
                )
              }
            />
          )}
          <ContentPageNavigation
            path={path}
            filters={filters}
            page={result.page}
            hasMore={result.hasMore}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
