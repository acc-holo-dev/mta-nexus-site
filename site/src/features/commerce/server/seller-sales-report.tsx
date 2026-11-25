import type { ExplicitFxRate, SellerSalesQuery, SellerSalesReport } from "@nexus/domain";
import { publicPriceEstimates, SELLER_SALES_EVIDENCE } from "@nexus/domain";
import { Button, EmptyState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import {
  linkAccentSmRounded,
  linkAccentTightRounded,
  linkAccentTightSmRounded,
} from "../../shell/link-shell";
import { pageShellMax6xl } from "../../shell/page-shell";
import { panelSpace3P4, panelSpace3P5 } from "../../shell/panel-shell";
import { surfaceP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeBlockMinH11SurfaceP2,
  typeBorderT,
  typeBreakLgPrimary,
  typeBreakSemiboldPrimary,
  typeDisplayPrimary,
  typeFlexEndGap4,
  typeFlexGap4Sm,
  typeFlexWrapGap4Sm,
  typeLgSemibold,
  typeNumericPrimary,
  typeP3Numeric,
  typeSmMuted,
  typeSmSecondary,
  typeSpace1Sm,
  typeSpace2Sm,
  typeSpace3BorderTPt5,
  typeWFullLeftSm,
  typeXlPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatFinancialMinor } from "../financial-i18n";
import { sellerSalesCopy, sellerSalesTime } from "../seller-sales-i18n";
import { sellerSalesUrl, sellerSaleUrl } from "../seller-sales-query";
import { getWalletCopy } from "../wallet-i18n";

type Scopes = { scopes: { id: string; name: string }[]; page: number; totalPages: number };

function GrossEstimate({
  amount,
  copy,
  currency,
  locale,
  rates,
}: {
  amount: number | string;
  copy: ReturnType<typeof getWalletCopy>;
  currency: string;
  locale: Locale;
  rates: readonly ExplicitFxRate[] | null | undefined;
}) {
  const text = String(amount);
  if (!/^-?\d+$/u.test(text)) return null;
  const minor = Number(text);
  if (!Number.isSafeInteger(minor)) return null;
  const lines = publicPriceEstimates({ price: minor, currency }, rates);
  if (lines === undefined) return null;
  if (lines === null) return <p className={typeXsMuted}>{copy.fxUnavailable}</p>;
  return (
    <ul className={typeXsMuted}>
      {lines.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? copy.fxEstimate.replace(
                "{destination}",
                formatFinancialMinor(line.amount, line.quote, locale),
              )
            : line.kind === "dust"
              ? copy.fxDust
              : line.kind === "invalid"
                ? copy.fxExceeds
                : `${line.quote}: ${copy.fxNone}`}
        </li>
      ))}
    </ul>
  );
}

export function SellerSalesReportView({
  report,
  query,
  scopes,
  locale,
  fxRates,
}: {
  report: SellerSalesReport;
  query: SellerSalesQuery;
  scopes: Scopes;
  locale: Locale;
  fxRates?: readonly ExplicitFxRate[] | null;
}) {
  const c = sellerSalesCopy(locale);
  const walletCopy = fxRates === undefined ? null : getWalletCopy(locale);
  const walletEnabled = isWalletEngineEnabled();
  const resetHref = sellerSalesUrl({
    page: 1,
    days: "all",
    status: "completed",
    evidence: "all",
    organizationId: query.organizationId,
    attribution: query.attribution,
  });
  const filtered =
    query.page !== 1 ||
    query.days !== "all" ||
    query.status !== "completed" ||
    query.evidence !== "all" ||
    Boolean(query.currency || query.productId);
  const exportUrl = sellerSalesUrl(query, report.page).replace(
    "/workspace/sales/report",
    "/api/sales/export",
  );
  return (
    <div className={pageShellMax6xl}>
      <Link href="/workspace/sales" className={linkAccentTightSmRounded}>
        {c.back}
      </Link>
      <header className="space-y-2">
        <h1 className={typeDisplayPrimary}>{c.title}</h1>
        <h2 className={typeXlPrimary}>{report.scope.name ?? c.personal}</h2>
        <p className={typeSmMuted}>
          {c.observed}:{" "}
          <time dateTime={report.observedAt.toISOString()}>
            {sellerSalesTime(report.observedAt, locale)} UTC
          </time>
        </p>
      </header>
      <p role="note" className={surfaceP4TextSmSecondary}>
        {query.attribution === "recorded" ? c.recordedNotice : c.notice}
      </p>
      <p role="note" className={typeSmSecondary}>
        {walletEnabled ? c.walletPaymentNotice : c.paymentNotice}
      </p>
      <Link
        href={`/workspace/finance${query.organizationId ? `?${new URLSearchParams({ organizationId: query.organizationId })}` : ""}`}
        className={linkAccentTightSmRounded}
      >
        {c.finance}
      </Link>
      {walletEnabled ? (
        <Link href="/workspace/wallet" className={linkAccentTightSmRounded}>
          {c.wallet}
        </Link>
      ) : null}
      <search aria-label={c.filters}>
        <form
          action="/workspace/sales/report"
          method="get"
          className="nexus-panel grid gap-4 p-5 sm:grid-cols-3"
        >
          <label className={typeSpace1Sm}>
            <span>{c.attribution}</span>
            <select
              name="attribution"
              defaultValue={query.attribution ?? "portfolio"}
              className={typeBlockMinH11SurfaceP2}
            >
              <option value="portfolio">{c.portfolio}</option>
              <option value="recorded">{c.recorded}</option>
            </select>
          </label>
          {query.organizationId ? (
            <input type="hidden" name="organizationId" value={query.organizationId} />
          ) : null}
          <label className={typeSpace1Sm}>
            <span>{c.days}</span>
            <select
              name="days"
              defaultValue={String(query.days)}
              className={typeBlockMinH11SurfaceP2}
            >
              <option value="all">{c.allTime}</option>
              {[7, 30, 90, 365].map((days) => (
                <option key={days} value={days}>
                  {days} {c.dayUnit}
                </option>
              ))}
            </select>
          </label>
          <label className={typeSpace1Sm}>
            <span>{c.status}</span>
            <select name="status" defaultValue={query.status} className={typeBlockMinH11SurfaceP2}>
              {(["completed", "refunded", "all"] as const).map((status) => (
                <option key={status} value={status}>
                  {c.statuses[status]}
                </option>
              ))}
            </select>
          </label>
          <label className={typeSpace1Sm}>
            <span>{c.evidenceTitle}</span>
            <select
              name="evidence"
              defaultValue={query.evidence}
              className={typeBlockMinH11SurfaceP2}
            >
              {(["all", ...SELLER_SALES_EVIDENCE] as const).map((value) => (
                <option key={value} value={value}>
                  {c.evidence[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={typeSpace1Sm}>
            <span>{c.currency}</span>
            <select
              name="currency"
              defaultValue={query.currency ?? "all"}
              className={typeBlockMinH11SurfaceP2}
            >
              <option value="all">{c.all}</option>
              {["USD", "EUR", "RUB"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className={typeSpace1Sm}>
            <span>{c.product}</span>
            <input
              name="productId"
              defaultValue={query.productId ?? ""}
              maxLength={128}
              pattern="[A-Za-z0-9_-]+"
              className={typeBlockMinH11SurfaceP2}
            />
          </label>
          <div className={typeFlexEndGap4}>
            <Button type="submit" size="touch">
              {c.apply}
            </Button>
            <Link href={resetHref} className={linkAccentTightSmRounded}>
              {c.reset}
            </Link>
          </div>
        </form>
      </search>
      {report.product ? (
        <h2 className={typeBreakLgPrimary}>
          {report.product.title} · {report.product.id}
        </h2>
      ) : null}
      {report.totals.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {report.totals.map((total) => (
            <li key={total.currency} className={panelSpace3P4}>
              <h2 className={typeLgSemibold}>{total.currency}</h2>
              <dl className={typeSpace2Sm}>
                <div>
                  <dt>{c.gross}</dt>
                  <dd className={typeNumericPrimary}>
                    {total.gross === null
                      ? c.unknown
                      : formatFinancialMinor(total.gross, total.currency, locale)}
                  </dd>
                  {walletCopy && total.gross !== null ? (
                    <GrossEstimate
                      amount={total.gross}
                      copy={walletCopy}
                      currency={total.currency}
                      locale={locale}
                      rates={fxRates}
                    />
                  ) : null}
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
      <a
        href={exportUrl}
        className="inline-block rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.export}
      </a>
      {report.sales.length ? (
        <ol className="space-y-3">
          {report.sales.map((sale) => (
            <li key={sale.id} className={panelSpace3P5}>
              <h2 className={typeBreakSemiboldPrimary}>{sale.productTitle}</h2>
              <p className={typeSmSecondary}>
                {sale.orderNumber} ·{" "}
                <time dateTime={sale.createdAt.toISOString()}>
                  {sellerSalesTime(sale.createdAt, locale)}
                </time>
              </p>
              <p className={typeNumericPrimary}>
                {formatFinancialMinor(sale.unitPrice, sale.currency, locale)}
              </p>
              {walletCopy ? (
                <GrossEstimate
                  amount={sale.unitPrice}
                  copy={walletCopy}
                  currency={sale.currency}
                  locale={locale}
                  rates={fxRates}
                />
              ) : null}
              <p className={typeSmSecondary}>
                {c.statuses[sale.status]} · {c.evidence[sale.evidence]}
              </p>
              <Link
                href={sellerSaleUrl(sale.id, query.organizationId, query.attribution)}
                className={linkAccentTightSmRounded}
              >
                {c.details}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={c.empty}
          description={query.attribution === "recorded" ? c.recordedNotice : c.notice}
          action={
            filtered ? (
              <Link href={resetHref} className={linkAccentSmRounded}>
                {c.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {report.totalPages > 1 ? (
        <nav aria-label={c.page} className={typeFlexGap4Sm}>
          {report.page > 1 ? (
            <Link
              href={sellerSalesUrl(query, report.page - 1, scopes.page)}
              className={linkAccentTightRounded}
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
              className={linkAccentTightRounded}
            >
              {c.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      {report.periods.length ? (
        <section className="space-y-3">
          <h2 className={typeXlPrimary}>{c.periods}</h2>
          <p className={typeSmSecondary}>{c.periodNotice}</p>
          <div className="overflow-x-auto">
            <table className={typeWFullLeftSm}>
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
                  <tr key={`${period.period}:${period.currency}`} className={typeBorderT}>
                    <td className="p-3">{period.period}</td>
                    <td className="p-3">{period.currency}</td>
                    <td className="p-3">{period.lines}</td>
                    <td className={typeP3Numeric}>
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
      <section className={typeSpace3BorderTPt5}>
        <h2 className="text-lg">{c.organizations}</h2>
        <nav aria-label={c.account} className={typeFlexWrapGap4Sm}>
          <Link
            href={sellerSalesUrl({ ...query, organizationId: undefined, productId: undefined }, 1)}
            className={linkAccentTightRounded}
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
              className={linkAccentTightRounded}
            >
              {scope.name}
            </Link>
          ))}
        </nav>
        {scopes.totalPages > 1 ? (
          <nav aria-label={c.organizations} className={typeFlexGap4Sm}>
            {scopes.page > 1 ? (
              <Link
                href={sellerSalesUrl(query, report.page, scopes.page - 1)}
                className={linkAccentTightRounded}
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
                className={linkAccentTightRounded}
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
