import Link from "next/link";
import { cookies } from "next/headers";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { serverContentService } from "../../../../../lib/services/server-content-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getUserPlatformCopy, userPlatformError } from "../../../../../lib/user-platform-copy";
import { serverContentCopy } from "../../../../../lib/server-content-copy";
import { serverContentId } from "../../../../../lib/server-content-api";
import { parseContentPage, writerTypes } from "../../../../../lib/user-platform-contract";
import {
  ContentCatalogControls,
  ContentPageNavigation,
  PlatformSignIn,
} from "../../../../../components/content-catalog-controls";
export const dynamic = "force-dynamic";
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
  if (!actor) return <PlatformSignIn locale={locale} />;
  const { id } = await params,
    path = `/workspace/servers/${encodeURIComponent(id)}/content`,
    filters = parseContentPage((await searchParams) ?? {});
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(() => serverContentService.page(serverContentId(id), actor, filters))
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? userPlatformError(locale, error.code) : copy.unavailable;
      return null;
    });
  return (
    <div className="space-y-6">
      <Link
        href={`/workspace/servers/${encodeURIComponent(id)}`}
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {team.back}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">
            {team.title}
            {result ? `: ${result.server.name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted">{team.description}</p>
          <p className="mt-2 text-sm text-muted">{team.notice}</p>
        </div>
        {result && (
          <Link
            href={`${path}/new`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {team.new}
          </Link>
        )}
      </header>
      {!result ? (
        <div className="nexus-panel space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
          <Link href={path} className="text-sm text-accent underline">
            {copy.retry}
          </Link>
        </div>
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
                <article key={item.id} className="nexus-panel space-y-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="break-words font-heading text-primary">
                      <Link
                        href={`${path}/${encodeURIComponent(item.id)}`}
                        className="hover:underline"
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
                    <Link
                      href={`${path}/${encodeURIComponent(item.id)}`}
                      className="text-accent underline"
                    >
                      {copy.edit}
                    </Link>
                    {item.status === "published" && (
                      <Link
                        href={`/articles/${encodeURIComponent(item.slug)}`}
                        className="text-accent underline"
                      >
                        {copy.publicView}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="nexus-panel p-6 text-sm text-muted">{copy.empty}</p>
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
