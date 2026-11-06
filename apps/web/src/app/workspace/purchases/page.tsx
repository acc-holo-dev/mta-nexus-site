import { orderRepository } from "@nexus/db";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { HistoryPagination, HistoryShell } from "../../../components/commerce-history-ui";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getCommercialCopy } from "../../../lib/commercial-i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { orderCaseCopy } from "../../../lib/order-case-i18n";
import { authService } from "../../../lib/services/auth-service";

const pageShellClass = "min-w-0 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Purchase history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function PurchasesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  const dictionary = getDictionary(typedLocale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) {
    const page = typeof query.page === "string" ? query.page : undefined;
    const returnPath =
      page && page !== "1"
        ? `/workspace/purchases?page=${encodeURIComponent(page)}`
        : "/workspace/purchases";
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }

  const page = parseHistoryPage(query.page);
  const retryHref =
    page > 1
      ? `/workspace/purchases?page=${encodeURIComponent(String(page))}`
      : "/workspace/purchases";
  const result = await orderRepository.pageBuyerHistory(user.id, page).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <HistoryShell copy={copy} area="purchases">
          <ErrorState
            id="workspace-purchases-unavailable"
            title={copy.purchasesLoadUnavailable}
            description={copy.purchasesLoadUnavailableHint}
            action={
              <Link href={retryHref} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </HistoryShell>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <HistoryShell copy={copy} area="purchases">
        <Link href="/subscriptions" className={navLinkClass}>
          {getCommercialCopy(typedLocale).catalog}
        </Link>
        <Link href="/workspace/order-cases" className={navLinkClass}>
          {orderCaseCopy(typedLocale).buyerCases}
        </Link>
        {result.orders.length === 0 ? (
          <EmptyState
            title={copy.emptyPurchases}
            description={copy.emptyPurchasesHint}
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {result.orders.map((order) => (
              <li key={order.id} className="nexus-panel min-w-0 space-y-3 p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-base font-semibold text-primary">
                    {copy.orderNumber}: {order.orderNumber}
                  </h2>
                  <span className="rounded-md border border-base px-2 py-1 text-xs text-secondary">
                    {orderStatusLabel(order.status, copy.orderStatuses)}
                  </span>
                </div>
                <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.placed}</dt>
                    <dd className="text-primary">
                      <time dateTime={order.createdAt.toISOString()}>
                        {formatHistoryDate(order.createdAt, typedLocale)}
                      </time>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.total}</dt>
                    <dd className="font-numeric font-semibold text-primary">
                      {formatHistoryAmount(order.totalAmount, order.currency, typedLocale)}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/workspace/purchases/${encodeURIComponent(order.id)}`}
                  className={navLinkClass}
                >
                  {copy.details}
                </Link>
              </li>
            ))}
          </ol>
        )}
        <HistoryPagination
          copy={copy}
          area="purchases"
          page={result.page}
          totalPages={result.totalPages}
        />
      </HistoryShell>
    </div>
  );
}
