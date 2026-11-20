import type { OrderTermsReport } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace4P5 } from "../../shell/panel-shell";
import { surfaceP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeGridGap3Sm2,
  typeLgSemibold,
  typeSmSecondary,
} from "../../shell/type-shell";
import { formatFinancialMinor } from "../financial-i18n";
import { orderTermsCopy, orderTermsLicenseLabel } from "../order-terms-i18n";
import { sellerSalesTime } from "../seller-sales-i18n";

// Honesty residual: consistency flags via ErrorState.
const ORDER_TERMS_FLAG_IDS = {
  amountMismatch: "order-terms-amount-mismatch",
  currencyMismatch: "order-terms-currency-mismatch",
  negativeValues: "order-terms-negative-values",
  unsupportedCurrency: "order-terms-unsupported-currency",
} as const;

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
    <div className={pageShellMax5xl}>
      <Link href={base} className={linkAccentSmRounded}>
        {c.back}
      </Link>
      <header className="min-w-0 space-y-3">
        <h1 className={typeDisplayPrimary}>{c.title}</h1>
        <h2 className="break-words text-xl">{report.order.orderNumber}</h2>
        <p className="text-sm text-muted">
          {c.observed}:{" "}
          <time dateTime={report.observedAt.toISOString()}>
            {sellerSalesTime(report.observedAt, locale)}
          </time>
        </p>
      </header>
      <p role="note" className={surfaceP4TextSmSecondary}>
        {c.notice}
      </p>
      <section className={panelMinSpace4P5}>
        <h2 className={typeLgSemibold}>{c.check}</h2>
        <p className={typeSmSecondary}>{c.consistencyNotice}</p>
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
          <div className="space-y-3">
            {flags.map((key) => (
              <ErrorState
                key={key}
                id={ORDER_TERMS_FLAG_IDS[key]}
                title={c[key]}
                description={c.consistencyNotice}
              />
            ))}
          </div>
        ) : (
          <p className={typeSmSecondary}>{c.clear}</p>
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
      <a href={`${api}/export?page=${report.page}`} className={linkAccentSmRounded}>
        {c.export}
      </a>
      {report.lines.length ? (
        <ol className="space-y-4">
          {report.lines.map((line) => (
            <li key={line.id} className={panelMinSpace4P5}>
              <h2 className="break-words text-lg font-semibold">
                {line.terms?.product.title ?? line.productId}
              </h2>
              <p className={typeSmSecondary}>
                {c[line.evidence]} · {line.id}
              </p>
              <p className="font-numeric">
                {c.linePrice}: {formatFinancialMinor(line.unitPrice, line.currency, locale)}
              </p>
              {line.terms ? (
                <>
                  <dl className={typeGridGap3Sm2}>
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
        <EmptyState
          title={c.empty}
          description={c.notice}
          icon={<ScrollText className="h-6 w-6" aria-hidden="true" />}
        />
      )}
      {report.totalPages > 1 ? (
        <nav aria-label={c.page} className={typeFlexWrapGap4Sm}>
          {report.page > 1 ? (
            <Link href={`${base}/terms?page=${report.page - 1}`} className={linkAccentSmRounded}>
              {c.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {c.page} {report.page} {c.of} {report.totalPages}
          </span>
          {report.page < report.totalPages ? (
            <Link href={`${base}/terms?page=${report.page + 1}`} className={linkAccentSmRounded}>
              {c.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
