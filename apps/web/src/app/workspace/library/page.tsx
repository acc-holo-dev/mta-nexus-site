import { type UserLibraryFilter, userLibraryRepository } from "@nexus/db";
import { EmptyState, StatusBadge } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ResourceDownloadButton } from "../../../components/resource-download-button";
import { formatHistoryDate } from "../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../lib/i18n-server";
import { libraryCollectionInventoryCopy } from "../../../lib/library-collection-inventory-i18n";
import { collectionInventoryHref } from "../../../lib/library-collection-inventory-query";
import { libraryCollectionsCopy } from "../../../lib/library-collections-i18n";
import {
  getLibraryCopy,
  libraryHref,
  parseLibraryFilter,
  parseLibraryPage,
} from "../../../lib/library-view";
import { getReleaseHistoryCopy, releaseHistoryHref } from "../../../lib/public-release-history";
import { getResourceActivityCopy } from "../../../lib/resource-activity-i18n";
import { resourceCartReceiptsCopy } from "../../../lib/resource-cart-receipts-i18n";
import { getResourceCommerceCopy } from "../../../lib/resource-commerce-i18n";
import { resourceDeliveriesCopy } from "../../../lib/resource-deliveries-i18n";
import { getResourceReleaseControlCopy } from "../../../lib/resource-release-control-i18n";
import { resourceReleaseWatchesCopy } from "../../../lib/resource-release-watches-i18n";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";
import { authService } from "../../../lib/services/auth-service";

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
  const releaseCopy = getReleaseHistoryCopy(locale);
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

      <Link
        href="/workspace/library/collections"
        className="inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {libraryCollectionsCopy(locale).title}
      </Link>
      <Link
        href={collectionInventoryHref()}
        className="inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {libraryCollectionInventoryCopy(locale).inventory}
      </Link>
      <Link
        href="/workspace/cart"
        className="inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {getResourceCommerceCopy(locale).openCart}
      </Link>
      <Link
        href="/workspace/acquisitions"
        className="ml-3 inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {getResourceActivityCopy(locale).history}
      </Link>
      <Link
        href="/workspace/library/updates"
        className="ml-3 inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {getResourceReleaseControlCopy(locale).updates}
      </Link>
      <Link
        href="/workspace/library/downloads"
        className="ml-3 inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {resourceDeliveriesCopy(locale).title}
      </Link>
      <Link
        href="/workspace/library/watches"
        className="ml-3 inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {resourceReleaseWatchesCopy(locale).title}
      </Link>
      <Link href="/workspace/acquisitions/receipts" className="text-sm text-accent underline">
        {resourceCartReceiptsCopy(locale).title}
      </Link>
      <Link
        href="/workspace/library/reviews"
        className="ml-3 inline-block rounded-lg border border-base px-4 py-2 text-sm text-accent"
      >
        {resourceReviewCopy(locale).own}
      </Link>
      <nav aria-label={copy.title} className="flex flex-wrap gap-2">
        {filters.map((value) => (
          <Link
            key={value}
            href={libraryHref(value, 1)}
            aria-current={filter === value ? "page" : undefined}
            className="inline-flex h-10 items-center rounded-lg border border-base bg-surface px-4 text-sm text-secondary transition-colors hover:border-strong hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] aria-[current=page]:border-transparent aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy[value]} ({result.counts[value]})
          </Link>
        ))}
      </nav>

      <p role="note" className="rounded-lg border border-base bg-surface p-4 text-sm text-muted">
        {copy.note}
      </p>

      {result.items.length === 0 ? (
        <EmptyState
          title={result.counts.all === 0 ? copy.empty : copy.emptyFilter}
          description={copy.subtitle}
          action={
            <Link href="/market?maxPrice=0" className="text-sm font-medium text-accent underline">
              {copy.browse}
            </Link>
          }
        />
      ) : (
        <ol className="grid gap-4 md:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.resourceId} className="nexus-panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 break-words text-base font-semibold text-primary">
                  {item.downloadable ? item.title : copy.unavailableResource}
                </h2>
                <StatusBadge
                  status={item.downloadable ? copy.ready : copy.unavailable}
                  tone={item.downloadable ? "success" : "neutral"}
                />
              </div>

              <p className="text-xs text-muted">
                {copy.added}{" "}
                <time dateTime={new Date(item.addedAt).toISOString()}>
                  {formatHistoryDate(new Date(item.addedAt), locale)}
                </time>
              </p>

              {item.downloadable && item.slug && item.version ? (
                <div className="mt-auto space-y-3">
                  <p className="text-xs text-secondary">{copy.availableReason}</p>
                  <ResourceDownloadButton
                    productId={item.resourceId}
                    version={item.version}
                    buildId={item.buildId ?? undefined}
                  />
                  <div className="flex flex-wrap gap-4">
                    <Link
                      href={`/market/${item.slug}`}
                      className="inline-block text-sm text-accent underline"
                    >
                      {copy.open}
                    </Link>
                    <Link
                      href={releaseHistoryHref(item.slug)}
                      className="inline-block text-sm text-accent underline"
                    >
                      {releaseCopy.browse}
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-auto text-sm text-muted">{copy.unavailableReason}</p>
              )}
              <Link
                href={`/workspace/library/${encodeURIComponent(item.resourceId)}/versions`}
                className="text-sm text-accent underline"
              >
                {getResourceReleaseControlCopy(locale).manage}
              </Link>
              <Link
                href={`/workspace/library/${encodeURIComponent(item.resourceId)}/collections`}
                className="text-sm text-accent underline"
              >
                {libraryCollectionsCopy(locale).resourceCollections}
              </Link>
              <Link
                href={`/workspace/library/review/${encodeURIComponent(item.resourceId)}`}
                className="text-sm text-accent underline"
              >
                {resourceReviewCopy(locale).write}
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-secondary">
        <p>
          {copy.showing} {result.items.length} {copy.of} {result.total}
        </p>
        {result.totalPages > 1 && (
          <nav aria-label={copy.page} className="flex flex-wrap items-center gap-4">
            {result.page > 1 ? (
              <Link href={libraryHref(filter, result.page - 1)} className="text-accent underline">
                {copy.previous}
              </Link>
            ) : null}
            <span>
              {copy.page} {result.page} {copy.of} {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={libraryHref(filter, result.page + 1)} className="text-accent underline">
                {copy.next}
              </Link>
            ) : null}
          </nav>
        )}
      </div>
    </div>
  );
}
