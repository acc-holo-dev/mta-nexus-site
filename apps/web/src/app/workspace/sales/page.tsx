import { orderRepository } from "@nexus/db";
import { EmptyState, ErrorState } from "@nexus/ui";
import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { HistoryPagination, HistoryShell } from "../../../components/commerce-history-ui";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import { getFinancialCopy } from "../../../lib/financial-i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { sellerSalesCopy } from "../../../lib/seller-sales-i18n";
import { authService } from "../../../lib/services/auth-service";

const pageShellClass = "min-w-0 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sales history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function SalesHistoryPage({
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
        ? `/workspace/sales?page=${encodeURIComponent(page)}`
        : "/workspace/sales";
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }

  const page = parseHistoryPage(query.page);
  const retryHref =
    page > 1 ? `/workspace/sales?page=${encodeURIComponent(String(page))}` : "/workspace/sales";
  const result = await orderRepository.pageSellerHistory(user.id, page).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <HistoryShell copy={copy} area="sales">
          <ErrorState
            id="workspace-sales-unavailable"
            title={copy.salesLoadUnavailable}
            description={copy.salesLoadUnavailableHint}
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
      <HistoryShell copy={copy} area="sales">
        <Link href="/workspace/sales/report" className={navLinkClass}>
          {sellerSalesCopy(typedLocale).title}
        </Link>
        <Link href="/workspace/finance" className={navLinkClass}>
          {getFinancialCopy(typedLocale).title}
        </Link>
        <p role="note" className="text-sm text-muted">
          {copy.grossNotice}
        </p>
        {result.sales.length === 0 ? (
          <EmptyState
            title={copy.emptySales}
            description={copy.emptySalesHint}
            icon={<ShoppingBag className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {result.sales.map((sale) => (
              <li key={sale.id} className="nexus-panel min-w-0 space-y-3 p-5">
                <h2 className="min-w-0 break-words text-base font-semibold text-primary">
                  {sale.productTitle}
                </h2>
                <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.orderNumber}</dt>
                    <dd className="break-words text-primary">{sale.orderNumber}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.placed}</dt>
                    <dd className="text-primary">
                      <time dateTime={sale.createdAt.toISOString()}>
                        {formatHistoryDate(sale.createdAt, typedLocale)}
                      </time>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{copy.grossPrice}</dt>
                    <dd className="font-numeric font-semibold text-primary">
                      {formatHistoryAmount(sale.unitPrice, sale.currency, typedLocale)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        )}
        <HistoryPagination
          copy={copy}
          area="sales"
          page={result.page}
          totalPages={result.totalPages}
        />
      </HistoryShell>
    </div>
  );
}
