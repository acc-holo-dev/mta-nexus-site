import { sellerSalesCopy } from "../../../lib/seller-sales-i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { getFinancialCopy } from "../../../lib/financial-i18n";
import { cookies } from "next/headers";
import { orderRepository } from "@nexus/db";
import { authService } from "../../../lib/services/auth-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../../lib/commerce-history-i18n";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../lib/commerce-history-format";
import {
  HistoryPagination,
  HistoryShell,
  HistorySignIn,
} from "../../../components/commerce-history-ui";

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
  const [locale, store, query] = await Promise.all([
    getRequestLocale(), cookies(), searchParams,
  ]);
  const copy = getCommerceHistoryCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <HistorySignIn copy={copy} />;

  const result = await orderRepository.pageSellerHistory(
    user.id,
    parseHistoryPage(query.page),
  );

  return (
    <HistoryShell copy={copy} area="sales">
      <Link href="/workspace/sales/report" className="text-sm text-accent underline">{sellerSalesCopy(locale).title}</Link>
      <Link href="/workspace/finance" className="text-sm text-accent underline">{getFinancialCopy(locale).title}</Link>
      <p role="note" className="text-sm text-muted">{copy.grossNotice}</p>
      {result.sales.length === 0 ? (
        <p className="py-12 text-sm text-secondary">{copy.emptySales}</p>
      ) : (
        <ol className="space-y-3">
          {result.sales.map((sale) => (
            <li key={sale.id} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words text-base font-semibold text-primary">
                {sale.productTitle}
              </h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">{copy.orderNumber}</dt>
                  <dd className="break-words text-primary">{sale.orderNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.placed}</dt>
                  <dd className="text-primary">
                    <time dateTime={sale.createdAt.toISOString()}>
                      {formatHistoryDate(sale.createdAt, locale)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.grossPrice}</dt>
                  <dd className="font-numeric font-semibold text-primary">
                    {formatHistoryAmount(sale.unitPrice, sale.currency, locale)}
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
  );
}
