import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { resourceActivityService } from "../../../lib/services/resources/resource-activity-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexMinWrapGap3,
  typeFlexWrapGap4Sm,
  typeGrid2Gap4,
  typeMax3xlSmSecondary,
  typeSmMuted,
  typeSmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";
import { getResourceActivityCopy } from "../resource-activity-i18n";
import {
  acquisitionHistoryHref,
  acquisitionPage,
  acquisitionSource,
} from "../resource-activity-view";
import { resourceCartReceiptsCopy } from "../resource-cart-receipts-i18n";

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
  const walletEnabled = isWalletEngineEnabled();
  const historyNote = walletEnabled ? copy.walletHistoryNote : copy.historyNote;
  const receiptsCopy = resourceCartReceiptsCopy(locale);
  const receiptsTitle = walletEnabled ? receiptsCopy.walletTitle : receiptsCopy.title;
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
      <div className={pageShellMax5xl}>
        <header className="space-y-3">
          <Link href="/workspace/library" className={linkAccentSmRounded}>
            {copy.library}
          </Link>
          <h1 className={typeDisplayPrimary}>{copy.history}</h1>
        </header>
        <ErrorState
          title={copy.historyLoadUnavailable}
          description={copy.historyLoadUnavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellMax5xl}>
      <header className="space-y-3">
        <Link href="/workspace/library" className={linkAccentSmRounded}>
          {copy.library}
        </Link>
        <h1 className={typeDisplayPrimary}>{copy.history}</h1>
        <Link href="/workspace/acquisitions/receipts" className={linkAccentSmRounded}>
          {receiptsTitle}
        </Link>
        <p className={typeMax3xlSmSecondary} role="note">
          {historyNote}
        </p>
      </header>
      <nav aria-label={copy.source} className={typeFlexMinWrapGap3}>
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
          description={historyNote}
          action={
            result.filter !== "all" ? (
              <Link href={acquisitionHistoryHref("all", 1)} className={linkAccentSmRounded}>
                {dictionary.articles.clearFilters}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ol className={typeGrid2Gap4}>
          {result.items.map((item) => (
            <li key={item.id} className={panelMinSpace3P5}>
              <h2 className="min-w-0 break-words text-base font-semibold">
                {item.downloadable ? item.title : copy.hidden}
              </h2>
              <p className={typeSmSecondary}>{copy[item.source]}</p>
              <p className={typeXsMuted}>
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
                <Link href={`/market/${item.slug}`} className={linkAccentSmRounded}>
                  {copy.open}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <p className={typeSmMuted}>
        {copy.showing} {result.items.length} {copy.of} {result.total}
      </p>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
          {result.page > 1 ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page - 1)}
              className={linkAccentSmRounded}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page + 1)}
              className={linkAccentSmRounded}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
