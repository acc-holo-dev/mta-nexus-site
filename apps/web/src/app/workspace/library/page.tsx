import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { userLibraryRepository, type UserLibraryFilter } from "@nexus/db";
import { ResourceDownloadButton } from "../../../components/resource-download-button";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { formatHistoryDate } from "../../../lib/commerce-history-format";
import {
  getLibraryCopy,
  libraryHref,
  parseLibraryFilter,
  parseLibraryPage,
} from "../../../lib/library-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource library | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function ResourceLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    page?: string | string[];
  }>;
}) {
  const [locale, cookieStore, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
  ]);
  const copy = getLibraryCopy(locale);
  const user = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!user) {
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-sm text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  }

  const filter = parseLibraryFilter(query.filter);
  const page = parseLibraryPage(query.page);
  const result = await userLibraryRepository.pageByUser(user.id, page, filter);
  const filters: readonly UserLibraryFilter[] = ["all", "ready", "unavailable"];

  return (
    <div className="mx-auto max-w-5xl space-y-7 py-8">
      <header className="space-y-3 border-b border-base pb-6">
        <Link href="/workspace" className="text-sm text-accent hover:underline">
          {copy.back}
        </Link>
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="max-w-2xl text-sm text-secondary">{copy.subtitle}</p>
      </header>

      <nav aria-label={copy.title} className="flex flex-wrap gap-2">
        {filters.map((value) => (
          <Link
            key={value}
            href={libraryHref(value, 1)}
            aria-current={filter === value ? "page" : undefined}
            className="rounded-md border border-base px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy[value]} ({result.counts[value]})
          </Link>
        ))}
      </nav>

      <p role="note" className="rounded-lg border border-base bg-surface p-4 text-sm text-muted">
        {copy.note}
      </p>

      {result.items.length === 0 ? (
        <div className="nexus-panel space-y-4 p-8 text-center">
          <p className="text-sm text-secondary">
            {result.counts.all === 0 ? copy.empty : copy.emptyFilter}
          </p>
          <Link href="/market?maxPrice=0" className="text-sm text-accent underline">
            {copy.browse}
          </Link>
        </div>
      ) : (
        <ol className="grid gap-4 md:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.resourceId} className="nexus-panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 break-words text-base font-semibold text-primary">
                  {item.downloadable ? item.title : copy.unavailableResource}
                </h2>
                <span className="rounded-md border border-base px-2 py-1 text-xs text-secondary">
                  {item.downloadable ? copy.ready : copy.unavailable}
                </span>
              </div>

              <p className="text-xs text-muted">
                {copy.added}{" "}
                <time dateTime={item.addedAt.toISOString()}>
                  {formatHistoryDate(item.addedAt, locale)}
                </time>
              </p>

              {item.downloadable && item.slug && item.version ? (
                <div className="mt-auto space-y-3">
                  <p className="text-xs text-secondary">{copy.availableReason}</p>
                  <ResourceDownloadButton
                    productId={item.resourceId}
                    version={item.version}
                  />
                  <Link
                    href={`/market/${item.slug}`}
                    className="inline-block text-sm text-accent underline"
                  >
                    {copy.open}
                  </Link>
                </div>
              ) : (
                <p className="mt-auto text-sm text-muted">{copy.unavailableReason}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-secondary">
        <p>{copy.showing} {result.items.length} {copy.of} {result.total}</p>
        {result.totalPages > 1 && (
          <nav aria-label={copy.page} className="flex flex-wrap items-center gap-4">
            {result.page > 1
              ? <Link href={libraryHref(filter, result.page - 1)} className="text-accent underline">{copy.previous}</Link>
              : null}
            <span>{copy.page} {result.page} {copy.of} {result.totalPages}</span>
            {result.page < result.totalPages
              ? <Link href={libraryHref(filter, result.page + 1)} className="text-accent underline">{copy.next}</Link>
              : null}
          </nav>
        )}
      </div>
    </div>
  );
}
