import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { sellerSalesService } from "../../../lib/services/commerce/seller-sales-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax3xl } from "../../shell/page-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { formatFinancialMinor } from "../financial-i18n";
import { sellerSalesCopy, sellerSalesTime } from "../seller-sales-i18n";
import { sellerSalesDetailQuery, sellerSalesUrl } from "../seller-sales-query";

const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

type Query = Record<string, string | string[] | undefined>;

export async function sellerSalesReportDetailMetadata(): Promise<Metadata> {
  return {
    title: `${sellerSalesCopy(await getRequestLocale()).detail} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SellerSalesReportDetailScreen({
  saleId,
  query,
}: {
  saleId: string;
  query: Query;
}) {
  const [store, locale] = await Promise.all([cookies(), getRequestLocale()]),
    c = sellerSalesCopy(locale);
  const dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={c.loadUnavailable}
        retryHref={"/workspace/sales/report/"}
      />
    );
  }

  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") pageParams.set(key, value);
  }
  const returnPath = `/workspace/sales/report/${encodeURIComponent(saleId)}${pageParams.size ? `?${pageParams}` : ""}`;
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
    ? sellerSalesService.detail(actor, saleId, organizationId, attribution)
    : sellerSalesService.detail(actor, saleId, organizationId)
  ).catch((error) => {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className={pageShellMax3xl}>
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
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
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
    <div className={pageShellMax3xl}>
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
      <dl className={panelSpace4P5}>
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
