import Link from "next/link";
import { cookies } from "next/headers";
import { authorContentRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../lib/user-platform-copy";
import { parseContentPage, writerTypes } from "../../../lib/user-platform-contract";
import {
  ContentCatalogControls,
  ContentPageNavigation,
  PlatformSignIn,
} from "../../../components/content-catalog-controls";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).studio,
    robots: { index: false, follow: false },
  };
}
export default async function AuthorContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getUserPlatformCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  const filters = parseContentPage(query);
  const result = await authorContentRepository.pageByAuthor(actor.id, filters).catch(() => null);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">{copy.studio}</h1>
          <p className="mt-2 text-sm text-muted">{copy.studioDescription}</p>
        </div>
        <Link
          href="/workspace/content/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {copy.create}
        </Link>
      </header>
      <ContentCatalogControls
        path="/workspace/content"
        filters={filters}
        locale={locale}
        types={writerTypes}
        showStatus
      />
      {!result ? (
        <p role="alert" className="nexus-panel p-5 text-sm text-danger">
          {copy.unavailable}
        </p>
      ) : (
        <>
          {result.items.length ? (
            <div className="space-y-3">
              {result.items.map((item) => (
                <article key={item.id} className="nexus-panel space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-heading text-primary">
                      <Link
                        href={`/workspace/content/${encodeURIComponent(item.id)}`}
                        className="hover:underline"
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <span className="text-xs text-secondary">{copy[item.status]}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{item.excerpt}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <span>
                      {copy.updated}:{" "}
                      {new Date(item.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                    </span>
                    <span>
                      {copy.comments}: {item.commentCount}
                    </span>
                    <Link
                      href={`/workspace/content/${encodeURIComponent(item.id)}`}
                      className="text-accent underline"
                    >
                      {copy.edit}
                    </Link>
                    {item.status === "published" && (
                      <Link href={`/articles/${item.slug}`} className="text-accent underline">
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
            path="/workspace/content"
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
