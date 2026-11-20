import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceActivityService } from "../../../lib/services/resources/resource-activity-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { getResourceActivityCopy } from "../resource-activity-i18n";
import {
  acquisitionHistoryHref,
  acquisitionPage,
  acquisitionSource,
} from "../resource-activity-view";
import { resourceCartReceiptsCopy } from "../resource-cart-receipts-i18n";

const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const filterLinkClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-4 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white";

export async function publisherAcquisitionsMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceActivityCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PublisherAcquisitionsScreen({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; source?: string | string[] }>;
}) {
  const [locale, cookieStore, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
  ]);
  const copy = getResourceActivityCopy(locale);
  const dictionary = getDictionary(locale);
  const page = acquisitionPage(query.page);
  const source = acquisitionSource(query.source);
  const retryHref = acquisitionHistoryHref(source, page);
  const returnQuery = new URLSearchParams();
  for (const key of ["page", "source"] as const) {
    const value = query[key];
    if (typeof value === "string") returnQuery.set(key, value);
  }
  const returnPath = `/workspace/acquisitions${returnQuery.size ? `?${returnQuery}` : ""}`;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.history}
        message={copy.historyLoadUnavailable}
        retryHref={retryHref}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  const result = await resourceActivityService.buyerHistory(actor, page, source).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <header className="space-y-3">
          <Link href="/workspace/library" className={navLinkClass}>
            {copy.library}
          </Link>
          <h1 className="font-display text-primary">{copy.history}</h1>
        </header>
        <ErrorState
          title={copy.historyLoadUnavailable}
          description={copy.historyLoadUnavailableHint}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <header className="space-y-3">
        <Link href="/workspace/library" className={navLinkClass}>
          {copy.library}
        </Link>
        <h1 className="font-display text-primary">{copy.history}</h1>
        <Link href="/workspace/acquisitions/receipts" className={navLinkClass}>
          {resourceCartReceiptsCopy(locale).title}
        </Link>
        <p className="max-w-3xl text-sm text-secondary" role="note">
          {copy.historyNote}
        </p>
      </header>
      <nav aria-label={copy.source} className="flex min-w-0 flex-wrap gap-3">
        {(["all", "direct", "cart"] as const).map((filter) => (
          <Link
            key={filter}
            href={acquisitionHistoryHref(filter, 1)}
            aria-current={result.filter === filter ? "page" : undefined}
            className={filterLinkClass}
          >
            {copy[filter]}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <EmptyState
          title={copy.empty}
          description={copy.historyNote}
          action={
            result.filter !== "all" ? (
              <Link href={acquisitionHistoryHref("all", 1)} className={navLinkClass}>
                {dictionary.articles.clearFilters}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.id} className={panelMinSpace3P5}>
              <h2 className="min-w-0 break-words text-base font-semibold">
                {item.downloadable ? item.title : copy.hidden}
              </h2>
              <p className="text-sm text-secondary">{copy[item.source]}</p>
              <p className="text-xs text-muted">
                {copy.acquiredAt}{" "}
                <time dateTime={item.acquiredAt.toISOString()}>
                  {formatHistoryDate(item.acquiredAt, locale)}
                </time>
              </p>
              <p className="text-sm">
                {!item.hasCurrentAccess
                  ? copy.accessRemoved
                  : item.downloadable
                    ? copy.ready
                    : copy.unavailable}
              </p>
              {item.downloadable && item.slug ? (
                <Link href={`/market/${item.slug}`} className={navLinkClass}>
                  {copy.open}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        {copy.showing} {result.items.length} {copy.of} {result.total}
      </p>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page - 1)}
              className={navLinkClass}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page + 1)}
              className={navLinkClass}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
