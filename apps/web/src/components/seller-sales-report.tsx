import type { SellerSalesQuery, SellerSalesReport } from "@nexus/domain";
import { SELLER_SALES_EVIDENCE } from "@nexus/domain";
import Link from "next/link";
import { formatFinancialMinor } from "../lib/financial-i18n";
import { sellerSalesCopy, sellerSalesTime } from "../lib/seller-sales-i18n";
import { sellerSalesUrl, sellerSaleUrl } from "../lib/seller-sales-query";

type Scopes = { scopes: { id: string; name: string }[]; page: number; totalPages: number };
export function SellerSalesReportView({
  report,
  query,
  scopes,
  locale,
}: {
  report: SellerSalesReport;
  query: SellerSalesQuery;
  scopes: Scopes;
  locale: "en" | "ru";
}) {
  const c = sellerSalesCopy(locale);
  const exportUrl = sellerSalesUrl(query, report.page).replace(
    "/workspace/sales/report",
    "/api/sales/export",
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <Link href="/workspace/sales" className="text-sm text-accent underline">
        {c.back}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{c.title}</h1>
        <h2 className="text-xl text-primary">{report.scope.name ?? c.personal}</h2>
        <p className="text-sm text-muted">
          {c.observed}:{" "}
          <time dateTime={report.observedAt.toISOString()}>
            {sellerSalesTime(report.observedAt, locale)} UTC
          </time>
        </p>
      </header>
      <p role="note" className="rounded-lg border border-base p-4 text-sm text-secondary">
        {query.attribution === "recorded" ? c.recordedNotice : c.notice}
      </p>
      <p role="note" className="text-sm text-secondary">
        {c.paymentNotice}
      </p>
      <Link
        href={`/workspace/finance${query.organizationId ? `?${new URLSearchParams({ organizationId: query.organizationId })}` : ""}`}
        className="text-sm text-accent underline"
      >
        {c.finance}
      </Link>
      <form
        action="/workspace/sales/report"
        method="get"
        className="nexus-panel grid gap-4 p-5 sm:grid-cols-3"
      >
        <label className="space-y-1 text-sm">
          <span>{c.attribution}</span>
          <select
            name="attribution"
            defaultValue={query.attribution ?? "portfolio"}
            className="block w-full rounded border border-base bg-surface p-2"
          >
            <option value="portfolio">{c.portfolio}</option>
            <option value="recorded">{c.recorded}</option>
          </select>
        </label>
        {query.organizationId ? (
          <input type="hidden" name="organizationId" value={query.organizationId} />
        ) : null}
        <label className="space-y-1 text-sm">
          <span>{c.days}</span>
          <select
            name="days"
            defaultValue={String(query.days)}
            className="block w-full rounded border border-base bg-surface p-2"
          >
            <option value="all">{c.allTime}</option>
            {[7, 30, 90, 365].map((days) => (
              <option key={days} value={days}>
                {days} {locale === "ru" ? "дней" : "days"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{c.status}</span>
          <select
            name="status"
            defaultValue={query.status}
            className="block w-full rounded border border-base bg-surface p-2"
          >
            {(["completed", "refunded", "all"] as const).map((status) => (
              <option key={status} value={status}>
                {c.statuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{c.evidenceTitle}</span>
          <select
            name="evidence"
            defaultValue={query.evidence}
            className="block w-full rounded border border-base bg-surface p-2"
          >
            {(["all", ...SELLER_SALES_EVIDENCE] as const).map((value) => (
              <option key={value} value={value}>
                {c.evidence[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{c.currency}</span>
          <select
            name="currency"
            defaultValue={query.currency ?? "all"}
            className="block w-full rounded border border-base bg-surface p-2"
          >
            <option value="all">{c.all}</option>
            {["USD", "EUR", "RUB"].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{c.product}</span>
          <input
            name="productId"
            defaultValue={query.productId ?? ""}
            maxLength={128}
            pattern="[A-Za-z0-9_-]+"
            className="block w-full rounded border border-base bg-surface p-2"
          />
        </label>
        <div className="flex items-end gap-4">
          <button type="submit" className="rounded bg-accent px-4 py-2 text-sm text-white">
            {c.apply}
          </button>
          <Link
            href={sellerSalesUrl({
              page: 1,
              days: "all",
              status: "completed",
              evidence: "all",
              organizationId: query.organizationId,
              attribution: query.attribution,
            })}
            className="text-sm text-accent underline"
          >
            {c.reset}
          </Link>
        </div>
      </form>
      {report.product ? (
        <h2 className="break-words text-lg text-primary">
          {report.product.title} · {report.product.id}
        </h2>
      ) : null}
      {report.totals.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {report.totals.map((total) => (
            <li key={total.currency} className="nexus-panel space-y-3 p-4">
              <h2 className="text-lg font-semibold">{total.currency}</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt>{c.gross}</dt>
                  <dd className="font-numeric text-primary">
                    {total.gross === null
                      ? c.unknown
                      : formatFinancialMinor(total.gross, total.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt>{c.lines}</dt>
                  <dd>{total.lines}</dd>
                </div>
                <div>
                  <dt>{c.orders}</dt>
                  <dd>{total.orders}</dd>
                </div>
                <div>
                  <dt>{c.review}</dt>
                  <dd>{total.reviewLines}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
      <a href={exportUrl} className="inline-block text-sm text-accent underline">
        {c.export}
      </a>
      {report.sales.length ? (
        <ol className="space-y-3">
          {report.sales.map((sale) => (
            <li key={sale.id} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words font-semibold text-primary">{sale.productTitle}</h2>
              <p className="text-sm text-secondary">
                {sale.orderNumber} ·{" "}
                <time dateTime={sale.createdAt.toISOString()}>
                  {sellerSalesTime(sale.createdAt, locale)}
                </time>
              </p>
              <p className="font-numeric text-primary">
                {formatFinancialMinor(sale.unitPrice, sale.currency, locale)}
              </p>
              <p className="text-sm text-secondary">
                {c.statuses[sale.status]} · {c.evidence[sale.evidence]}
              </p>
              <Link
                href={sellerSaleUrl(sale.id, query.organizationId, query.attribution)}
                className="text-sm text-accent underline"
              >
                {c.details}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-secondary">{c.empty}</p>
      )}
      {report.totalPages > 1 ? (
        <nav aria-label={c.page} className="flex gap-4 text-sm">
          {report.page > 1 ? (
            <Link
              href={sellerSalesUrl(query, report.page - 1, scopes.page)}
              className="text-accent underline"
            >
              {c.previous}
            </Link>
          ) : null}
          <span>
            {c.page} {report.page} {c.of} {report.totalPages}
          </span>
          {report.page < report.totalPages ? (
            <Link
              href={sellerSalesUrl(query, report.page + 1, scopes.page)}
              className="text-accent underline"
            >
              {c.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      {report.periods.length ? (
        <section className="space-y-3">
          <h2 className="text-xl text-primary">{c.periods}</h2>
          <p className="text-sm text-secondary">{c.periodNotice}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{c.periods}</caption>
              <thead>
                <tr>
                  {[c.period, c.currency, c.lines, c.gross].map((label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.periods.map((period) => (
                  <tr key={`${period.period}:${period.currency}`} className="border-t border-base">
                    <td className="p-3">{period.period}</td>
                    <td className="p-3">{period.currency}</td>
                    <td className="p-3">{period.lines}</td>
                    <td className="p-3 font-numeric">
                      {period.gross === null
                        ? c.unknown
                        : formatFinancialMinor(period.gross, period.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <section className="space-y-3 border-t border-base pt-5">
        <h2 className="text-lg">{c.organizations}</h2>
        <nav aria-label={c.account} className="flex flex-wrap gap-4 text-sm">
          <Link
            href={sellerSalesUrl({ ...query, organizationId: undefined, productId: undefined }, 1)}
            className="text-accent underline"
          >
            {c.personal}
          </Link>
          {scopes.scopes.map((scope) => (
            <Link
              key={scope.id}
              href={sellerSalesUrl(
                { ...query, organizationId: scope.id, productId: undefined },
                1,
                scopes.page,
              )}
              aria-current={query.organizationId === scope.id ? "page" : undefined}
              className="text-accent underline"
            >
              {scope.name}
            </Link>
          ))}
        </nav>
        {scopes.totalPages > 1 ? (
          <nav aria-label={c.organizations} className="flex gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link
                href={sellerSalesUrl(query, report.page, scopes.page - 1)}
                className="text-accent underline"
              >
                {c.previous}
              </Link>
            ) : null}
            <span>
              {c.page} {scopes.page} {c.of} {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link
                href={sellerSalesUrl(query, report.page, scopes.page + 1)}
                className="text-accent underline"
              >
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
