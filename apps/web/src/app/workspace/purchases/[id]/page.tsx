import { orderTermsCopy } from "../../../../lib/order-terms-i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { HistorySignIn } from "../../../../components/commerce-history-ui";
import { getResourceCommerceCopy } from "../../../../lib/resource-commerce-i18n";
import { getCommercialCopy } from "../../../../lib/commercial-i18n";
import { orderCaseCopy } from "../../../../lib/order-case-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { commerceService } from "../../../../lib/services/commerce-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../../lib/commerce-history-i18n";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../../../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Order details | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function OrderDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getCommerceHistoryCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <HistorySignIn copy={copy} />;
  const result = await commerceService.getBuyerOrderDetails(
    actor,
    id,
    parseHistoryPage(query.page),
  );
  if (!result) notFound();
  const { order, items } = result;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <header className="space-y-3 border-b border-base pb-5">
        <Link href="/workspace/purchases" className="text-sm text-accent underline">
          {copy.backToPurchases}
        </Link>
        <h1 className="break-words font-display text-primary">
          {copy.orderNumber}: {order.orderNumber}
        </h1>
        <p className="text-secondary">
          {copy.status}: {orderStatusLabel(order.status, copy.orderStatuses)}
        </p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
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
            <dd className="font-numeric text-primary">
              {formatHistoryAmount(order.totalAmount, order.currency, locale)}
            </dd>
          </div>
        </dl>
      </header>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/operations`}
        className="inline-block text-sm text-accent underline"
      >
        {getCommercialCopy(locale).paymentOperations}
      </Link>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/support`}
        className="inline-block text-sm text-accent underline"
      >
        {orderCaseCopy(locale).title}
      </Link>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/terms`}
        className="inline-block text-sm text-accent underline"
      >
        {orderTermsCopy(locale).title}
      </Link>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {copy.receiptNote}
      </p>
      <section className="space-y-4" aria-labelledby="order-items">
        <h2 id="order-items" className="text-xl font-semibold text-primary">
          {copy.lineItems} ({result.total})
        </h2>
        {items.length === 0 ? (
          <p className="text-secondary">{copy.emptyItems}</p>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="nexus-panel space-y-3 p-5">
                <h3 className="break-words font-semibold text-primary">
                  {item.productTitle ?? copy.unavailableResource}
                </h3>
                <p className="text-sm text-secondary">
                  {copy.linePrice}: {formatHistoryAmount(item.unitPrice, item.currency, locale)}
                </p>
                <p className="text-sm text-muted">
                  {item.hasCurrentAccess ? copy.accessReady : copy.accessMissing}
                </p>
                {item.hasCurrentAccess && (
                  <Link href="/workspace/library" className="mr-4 text-sm text-accent underline">
                    {getResourceCommerceCopy(locale).library}
                  </Link>
                )}
                {item.productSlug && (
                  <Link
                    href={`/market/${item.productSlug}`}
                    className="text-sm text-accent underline"
                  >
                    {copy.openResource}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex gap-4 text-sm text-secondary">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
