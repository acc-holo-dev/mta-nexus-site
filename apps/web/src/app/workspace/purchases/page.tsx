import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { orderRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getCommercialCopy } from "../../../lib/commercial-i18n";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import {
  HistoryPagination,
  HistoryShell,
  HistorySignIn,
} from "../../../components/commerce-history-ui";

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
  const [locale, store, query] = await Promise.all([
    getRequestLocale(), cookies(), searchParams,
  ]);
  const copy = getCommerceHistoryCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <HistorySignIn copy={copy} />;

  const result = await orderRepository.pageBuyerHistory(
    user.id,
    parseHistoryPage(query.page),
  );

  return (
    <HistoryShell copy={copy} area="purchases">
      <Link href="/subscriptions" className="inline-block text-sm text-accent underline">{getCommercialCopy(locale).catalog}</Link>
      {result.orders.length === 0 ? (
        <p className="py-12 text-sm text-secondary">{copy.emptyPurchases}</p>
      ) : (
        <ol className="space-y-3">
          {result.orders.map((order) => (
            <li key={order.id} className="nexus-panel space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="break-words text-base font-semibold text-primary">
                  {copy.orderNumber}: {order.orderNumber}
                </h2>
                <span className="rounded-md border border-base px-2 py-1 text-xs text-secondary">
                  {orderStatusLabel(order.status, copy.orderStatuses)}
                </span>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{copy.placed}</dt>
                  <dd className="text-primary">
                    <time dateTime={order.createdAt.toISOString()}>
                      {formatHistoryDate(order.createdAt, locale)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.total}</dt>
                  <dd className="font-numeric font-semibold text-primary">
                    {formatHistoryAmount(order.totalAmount, order.currency, locale)}
                  </dd>
                </div>
              </dl>
              <Link href={`/workspace/purchases/${encodeURIComponent(order.id)}`} className="inline-block text-sm text-accent underline">{copy.details}</Link>
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
  );
}
