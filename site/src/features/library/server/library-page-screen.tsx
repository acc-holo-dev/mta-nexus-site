import { EmptyState, ErrorState, StatusBadge } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  type UserLibraryFilter,
  userLibraryService,
} from "../../../lib/services/library/user-library-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { ResourceDownloadButton } from "../../resources/download";
import { getReleaseHistoryCopy, releaseHistoryHref } from "../../resources/public-release-history";
import { getResourceActivityCopy } from "../../resources/resource-activity-i18n";
import { resourceCartReceiptsCopy } from "../../resources/resource-cart-receipts-i18n";
import { getResourceCommerceCopy } from "../../resources/resource-commerce-i18n";
import { resourceDeliveriesCopy } from "../../resources/resource-deliveries-i18n";
import { resourceReleaseWatchesCopy } from "../../resources/resource-release-watches-i18n";
import { resourceReviewCopy } from "../../resources/resource-review-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentBorder, linkAccentSm, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xlMid } from "../../shell/page-shell";
import { panelFlexColGap3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { libraryCollectionInventoryCopy } from "../library-collection-inventory-i18n";
import { collectionInventoryHref } from "../library-collection-inventory-query";
import { libraryCollectionsCopy } from "../library-collections-i18n";
import { getLibraryCopy, libraryHref, parseLibraryFilter, parseLibraryPage } from "../library-view";
import { getResourceReleaseControlCopy } from "../resource-release-control-i18n";

export async function libraryPageMetadata(): Promise<Metadata> {
  return {
    title: `${getLibraryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryPageScreen({
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
  const dictionary = getDictionary(locale);
  const releaseCopy = getReleaseHistoryCopy(locale);
  const filter = parseLibraryFilter(query.filter);
  const page = parseLibraryPage(query.page);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.loadUnavailable}
        retryHref={libraryHref(filter, page)}
      />
    );
  }
  if (!user) return <PlatformSignIn locale={locale} returnPath={libraryHref(filter, page)} />;

  const result = await userLibraryService.pageByUser(user.id, page, filter).catch(() => null);
  const filters: readonly UserLibraryFilter[] = ["all", "ready", "unavailable"];

  return (
    <div className={pageShellMax5xlMid}>
      <header className="space-y-3 border-b border-base pb-6">
        <Link
          href="/workspace"
          className="text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="max-w-2xl text-sm text-secondary">{copy.subtitle}</p>
      </header>

      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href="/workspace/library/collections" className={linkAccentBorder}>
          {libraryCollectionsCopy(locale).title}
        </Link>
        <Link href={collectionInventoryHref()} className={linkAccentBorder}>
          {libraryCollectionInventoryCopy(locale).inventory}
        </Link>
        <Link href="/workspace/cart" className={linkAccentBorder}>
          {getResourceCommerceCopy(locale).openCart}
        </Link>
        <Link href="/workspace/acquisitions" className={linkAccentBorder}>
          {getResourceActivityCopy(locale).history}
        </Link>
        <Link href="/workspace/library/updates" className={linkAccentBorder}>
          {getResourceReleaseControlCopy(locale).updates}
        </Link>
        <Link href="/workspace/library/downloads" className={linkAccentBorder}>
          {resourceDeliveriesCopy(locale).title}
        </Link>
        <Link href="/workspace/library/watches" className={linkAccentBorder}>
          {resourceReleaseWatchesCopy(locale).title}
        </Link>
        <Link href="/workspace/acquisitions/receipts" className={linkAccentSm}>
          {resourceCartReceiptsCopy(locale).title}
        </Link>
        <Link href="/workspace/library/reviews" className={linkAccentBorder}>
          {resourceReviewCopy(locale).own}
        </Link>
      </div>
      {!result ? (
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={libraryHref(filter, page)} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : (
        <>
          <nav aria-label={copy.title} className="flex flex-wrap gap-2">
            {filters.map((value) => (
              <Link
                key={value}
                href={libraryHref(value, 1)}
                aria-current={filter === value ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-lg border border-base bg-surface px-4 text-sm text-secondary transition-colors hover:border-strong hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)] aria-[current=page]:border-transparent aria-[current=page]:bg-accent aria-[current=page]:text-white"
              >
                {copy[value]} ({result.counts[value]})
              </Link>
            ))}
          </nav>

          <p
            role="note"
            className="rounded-lg border border-base bg-surface p-4 text-sm text-muted"
          >
            {copy.note}
          </p>

          {result.items.length === 0 ? (
            <EmptyState
              title={result.counts.all === 0 ? copy.empty : copy.emptyFilter}
              description={result.counts.all === 0 ? copy.emptyHint : copy.emptyFilterHint}
              action={
                result.counts.all === 0 ? (
                  <Link
                    href="/market?maxPrice=0"
                    className="text-sm font-medium text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.browse}
                  </Link>
                ) : (
                  <Link
                    href={libraryHref("all", 1)}
                    className="text-sm font-medium text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.clearFilters}
                  </Link>
                )
              }
            />
          ) : (
            <ol className="grid gap-4 md:grid-cols-2">
              {result.items.map((item) => (
                <li key={item.resourceId} className={panelFlexColGap3P5}>
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
                        intent={item.buildId ? "selected" : "latest"}
                      />
                      <div className="flex flex-wrap gap-4">
                        <Link
                          href={`/market/${item.slug}`}
                          className="inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                        >
                          {copy.open}
                        </Link>
                        <Link
                          href={releaseHistoryHref(item.slug)}
                          className="inline-block text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                        >
                          {releaseCopy.browse}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <ErrorState
                      id="library-item-unavailable-reason"
                      title={copy.unavailableReason}
                      description={copy.unavailableReasonHint}
                    />
                  )}
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.resourceId)}/versions`}
                    className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {getResourceReleaseControlCopy(locale).manage}
                  </Link>
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.resourceId)}/collections`}
                    className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {libraryCollectionsCopy(locale).toCollection}
                  </Link>
                  <Link
                    href={`/workspace/library/review/${encodeURIComponent(item.resourceId)}`}
                    className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                  <Link
                    href={libraryHref(filter, result.page - 1)}
                    className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.previous}
                  </Link>
                ) : null}
                <span>
                  {copy.page} {result.page} {copy.of} {result.totalPages}
                </span>
                {result.page < result.totalPages ? (
                  <Link
                    href={libraryHref(filter, result.page + 1)}
                    className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.next}
                  </Link>
                ) : null}
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}
