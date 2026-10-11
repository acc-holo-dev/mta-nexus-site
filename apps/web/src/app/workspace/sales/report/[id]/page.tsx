import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatFinancialMinor } from "../../../../../lib/financial-i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { sellerSalesCopy, sellerSalesTime } from "../../../../../lib/seller-sales-i18n";
import { sellerSalesDetailQuery, sellerSalesUrl } from "../../../../../lib/seller-sales-query";
import { authService } from "../../../../../lib/services/auth-service";
import { sellerSalesService } from "../../../../../lib/services/seller-sales-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sale line | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SellerSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, { id }, query] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = sellerSalesCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display">{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) notFound();
    if (value !== undefined) values.set(key, value);
  }
  let selectors: ReturnType<typeof sellerSalesDetailQuery>;
  try {
    selectors = sellerSalesDetailQuery(values);
  } catch {
    notFound();
  }
  const { organizationId, attribution } = selectors;
  const result = await (attribution
    ? sellerSalesService.detail(actor, id, organizationId, attribution)
    : sellerSalesService.detail(actor, id, organizationId)
  ).catch((error) => {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    throw error;
  });
  const { sale, scope } = result;
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <Link
        href={sellerSalesUrl({
          page: 1,
          days: "all",
          status: "all",
          evidence: "all",
          organizationId,
          attribution,
        })}
        className="text-sm text-accent underline"
      >
        {c.back}
      </Link>
      <h1 className="font-display text-primary">{c.detail}</h1>
      <h2 className="break-words text-xl">{sale.productTitle}</h2>
      <p className="text-secondary">{scope.name ?? c.personal}</p>
      <p role="note" className="text-sm text-secondary">
        {attribution === "recorded" ? c.recordedNotice : c.notice}
      </p>
      <p role="note" className="text-sm text-secondary">
        {c.paymentNotice}
      </p>
      <dl className="nexus-panel space-y-4 p-5">
        {[
          [c.order, sale.orderNumber],
          [c.product, sale.productId],
          [c.status, c.statuses[sale.status]],
          [c.evidenceTitle, c.evidence[sale.evidence]],
          [c.gross, formatFinancialMinor(sale.unitPrice, sale.currency, locale)],
          [c.date, `${sellerSalesTime(sale.createdAt, locale)} UTC`],
          [c.observed, `${sellerSalesTime(result.observedAt, locale)} UTC`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-words text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {sale.inCurrentPortfolio !== false ? (
        <Link
          href={`/workspace/resources/${encodeURIComponent(sale.productId)}`}
          className="text-sm text-accent underline"
        >
          {c.manage}
        </Link>
      ) : null}
    </div>
  );
}
