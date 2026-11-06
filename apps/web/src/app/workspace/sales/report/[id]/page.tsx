import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { formatFinancialMinor } from "../../../../../lib/financial-i18n";
import { getDictionary } from "../../../../../lib/i18n";
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

const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") pageParams.set(key, value);
  }
  const returnPath = `/workspace/sales/report/${encodeURIComponent(id)}${pageParams.size ? `?${pageParams}` : ""}`;
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
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
    return null;
  });
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8">
        <Link
          href={sellerSalesUrl({
            page: 1,
            days: "all",
            status: "all",
            evidence: "all",
            organizationId,
            attribution,
          })}
          className={linkClass}
        >
          {c.back}
        </Link>
        <ErrorState
          id="workspace-sales-report-detail-unavailable"
          title={c.loadUnavailable}
          action={
            <Link href={returnPath} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const { sale, scope } = result;
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8">
      <Link
        href={sellerSalesUrl({
          page: 1,
          days: "all",
          status: "all",
          evidence: "all",
          organizationId,
          attribution,
        })}
        className={linkClass}
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
          className={linkClass}
        >
          {c.manage}
        </Link>
      ) : null}
    </div>
  );
}
