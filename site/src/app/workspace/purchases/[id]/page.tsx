import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../../lib/commerce-history-i18n";
import { getCommercialCopy } from "../../../../lib/commercial-i18n";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { orderCaseCopy } from "../../../../lib/order-case-i18n";
import { orderTermsCopy } from "../../../../lib/order-terms-i18n";
import { getResourceCommerceCopy } from "../../../../lib/resource-commerce-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { commerceService } from "../../../../lib/services/commerce-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  const dictionary = getDictionary(typedLocale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <PlatformSignIn
        locale={typedLocale}
        returnPath={`/workspace/purchases/${encodeURIComponent(id)}`}
      />
    );
  const page = parseHistoryPage(query.page);
  const retryHref = `/workspace/purchases/${encodeURIComponent(id)}${
    page > 1 ? `?page=${encodeURIComponent(String(page))}` : ""
  }`;
  let result: Awaited<ReturnType<typeof commerceService.getBuyerOrderDetails>>;
  try {
    result = await commerceService.getBuyerOrderDetails(actor, id, page);
  } catch {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/purchases" className={navLinkClass}>
          {copy.backToPurchases}
        </Link>
        <ErrorState
          title={copy.orderLoadUnavailable}
          description={copy.orderLoadUnavailableHint}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!result) notFound();
  const { order, items } = result;
  return (
    <div className={pageShellClass}>
      <header className="min-w-0 space-y-3 border-b border-base pb-5">
        <Link href="/workspace/purchases" className={navLinkClass}>
          {copy.backToPurchases}
        </Link>
        <h1 className="min-w-0 break-words font-display text-primary">
          {copy.orderNumber}: {order.orderNumber}
        </h1>
        <p className="text-secondary">
          {copy.status}: {orderStatusLabel(order.status, copy.orderStatuses)}
        </p>
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
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
            <dd className="font-numeric text-primary">
              {formatHistoryAmount(order.totalAmount, order.currency, typedLocale)}
            </dd>
          </div>
        </dl>
      </header>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/operations`}
        className={navLinkClass}
      >
        {getCommercialCopy(typedLocale).paymentOperations}
      </Link>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/support`}
        className={navLinkClass}
      >
        {orderCaseCopy(typedLocale).title}
      </Link>
      <Link href={`/workspace/purchases/${encodeURIComponent(id)}/terms`} className={navLinkClass}>
        {orderTermsCopy(typedLocale).title}
      </Link>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {copy.receiptNote}
      </p>
      <section className="min-w-0 space-y-4" aria-labelledby="order-items">
        <h2 id="order-items" className="text-xl font-semibold text-primary">
          {copy.lineItems} ({result.total})
        </h2>
        {items.length === 0 ? (
          <EmptyState
            title={copy.emptyItems}
            description={copy.emptyItemsHint}
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="nexus-panel min-w-0 space-y-3 p-5">
                <h3 className="min-w-0 break-words font-semibold text-primary">
                  {item.productTitle ?? copy.unavailableResource}
                </h3>
                <p className="text-sm text-secondary">
                  {copy.linePrice}:{" "}
                  {formatHistoryAmount(item.unitPrice, item.currency, typedLocale)}
                </p>
                <p className="text-sm text-muted">
                  {item.hasCurrentAccess ? copy.accessReady : copy.accessMissing}
                </p>
                {item.hasCurrentAccess && (
                  <Link href="/workspace/library" className={navLinkClass}>
                    {getResourceCommerceCopy(typedLocale).library}
                  </Link>
                )}
                {item.productSlug && (
                  <Link href={`/market/${item.productSlug}`} className={navLinkClass}>
                    {copy.openResource}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex min-w-0 flex-wrap gap-4 text-sm text-secondary">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className={navLinkClass}>
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className={navLinkClass}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
