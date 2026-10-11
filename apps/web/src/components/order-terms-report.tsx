import type { OrderTermsReport } from "@nexus/domain";
import Link from "next/link";
import { formatFinancialMinor } from "../lib/financial-i18n";
import { orderTermsCopy, orderTermsLicenseLabel } from "../lib/order-terms-i18n";
import { sellerSalesTime } from "../lib/seller-sales-i18n";
export function OrderTermsReportView({
  report,
  scope,
  locale,
}: {
  report: OrderTermsReport;
  scope: "buyer" | "admin";
  locale: "en" | "ru";
}) {
  const c = orderTermsCopy(locale),
    base =
      scope === "buyer"
        ? `/workspace/purchases/${encodeURIComponent(report.order.id)}`
        : `/admin/commerce/reconciliation/${encodeURIComponent(report.order.id)}`;
  const api =
    scope === "buyer"
      ? `/api/orders/${encodeURIComponent(report.order.id)}/terms`
      : `/api/admin/commerce/orders/${encodeURIComponent(report.order.id)}/terms`;
  const flags = (
    ["amountMismatch", "currencyMismatch", "negativeValues", "unsupportedCurrency"] as const
  ).filter((key) => report.summary[key]);
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href={base} className="text-sm text-accent underline">
        {c.back}
      </Link>
      <header className="space-y-3">
        <h1 className="font-display text-primary">{c.title}</h1>
        <h2 className="break-words text-xl">{report.order.orderNumber}</h2>
        <p className="text-sm text-muted">
          {c.observed}:{" "}
          <time dateTime={report.observedAt.toISOString()}>
            {sellerSalesTime(report.observedAt, locale)}
          </time>
        </p>
      </header>
      <p role="note" className="rounded-lg border border-base p-4 text-sm text-secondary">
        {c.notice}
      </p>
      <section className="nexus-panel space-y-4 p-5">
        <h2 className="text-lg font-semibold">{c.check}</h2>
        <p className="text-sm text-secondary">{c.consistencyNotice}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt>{c.total}</dt>
            <dd className="font-numeric">
              {formatFinancialMinor(report.order.totalAmount, report.order.currency, locale)}
            </dd>
          </div>
          <div>
            <dt>{c.lines}</dt>
            <dd>{report.summary.lines}</dd>
          </div>
          <div>
            <dt>{c.stored}</dt>
            <dd>{report.summary.recordedLines}</dd>
          </div>
        </dl>
        {flags.length ? (
          <ul className="space-y-2 text-sm text-warning">
            {flags.map((key) => (
              <li key={key}>{c[key]}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-secondary">{c.clear}</p>
        )}
        {report.summary.legacyLines > 0 ? (
          <p className="text-sm text-muted">
            {c.legacy}: {report.summary.legacyLines}
          </p>
        ) : null}
        <ul className="space-y-1 text-sm font-numeric">
          {report.summary.totals.map((total) => (
            <li key={total.currency}>
              {formatFinancialMinor(total.value, total.currency, locale)}
            </li>
          ))}
        </ul>
      </section>
      <a href={`${api}/export?page=${report.page}`} className="text-sm text-accent underline">
        {c.export}
      </a>
      {report.lines.length ? (
        <ol className="space-y-4">
          {report.lines.map((line) => (
            <li key={line.id} className="nexus-panel space-y-4 p-5">
              <h2 className="break-words text-lg font-semibold">
                {line.terms?.product.title ?? line.productId}
              </h2>
              <p className="text-sm text-secondary">
                {c[line.evidence]} · {line.id}
              </p>
              <p className="font-numeric">
                {c.linePrice}: {formatFinancialMinor(line.unitPrice, line.currency, locale)}
              </p>
              {line.terms ? (
                <>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">{c.date}</dt>
                      <dd>
                        <time dateTime={line.terms.recordedAt}>
                          {sellerSalesTime(new Date(line.terms.recordedAt), locale)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{c.seller}</dt>
                      <dd className="break-words">
                        {line.terms.seller.type === "user" ? c.user : c.organization} ·{" "}
                        {line.terms.seller.id}
                      </dd>
                    </div>
                  </dl>
                  <h3 className="text-sm font-semibold">{c.baseline}</h3>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">{c.commission}</dt>
                      <dd>{line.terms.baseline.commissionBps / 100}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{c.hold}</dt>
                      <dd>
                        {line.terms.baseline.holdDays} {c.days}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{c.license}</dt>
                      <dd>{orderTermsLicenseLabel(locale, line.terms.baseline.licenseModel)}</dd>
                    </div>
                  </dl>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{c.empty}</p>
      )}
      {report.totalPages > 1 ? (
        <nav aria-label={c.page} className="flex gap-4 text-sm">
          {report.page > 1 ? (
            <Link href={`${base}/terms?page=${report.page - 1}`} className="text-accent underline">
              {c.previous}
            </Link>
          ) : null}
          <span>
            {c.page} {report.page} {c.of} {report.totalPages}
          </span>
          {report.page < report.totalPages ? (
            <Link href={`${base}/terms?page=${report.page + 1}`} className="text-accent underline">
              {c.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
