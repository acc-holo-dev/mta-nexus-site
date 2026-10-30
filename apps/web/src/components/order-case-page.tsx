import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError, ORDER_CASE_REVIEW_STATUSES, type OrderCaseEvidence } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { authService } from "../lib/services/auth-service";
import { orderCaseService } from "../lib/services/order-case-service";
import { getRequestLocale } from "../lib/i18n-server";
import { getCommerceHistoryCopy } from "../lib/commerce-history-i18n";
import { formatHistoryAmount, formatHistoryDate } from "../lib/commerce-history-format";
import { financialOrderLabel, financialPaymentLabel } from "../lib/financial-i18n";
import { orderCasePageQuery } from "../lib/order-case-query";
import {
  orderCaseCopy,
  orderCaseKindLabel,
  orderCaseStatusLabel,
  orderCaseThreadLabel,
} from "../lib/order-case-i18n";
import { HistorySignIn } from "./commerce-history-ui";
import { OrderCaseCreateForm, OrderCaseReviewForm } from "./order-case-forms";
import { SupportCaseThread } from "./support-case-thread";

export async function orderCaseMetadata(staff = false): Promise<Metadata> {
  const copy = orderCaseCopy(await getRequestLocale());
  return {
    title: `${staff ? copy.queue : copy.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
type Query = Record<string, string | string[] | undefined>;
function scopedError(error: unknown): never {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
  throw error;
}
function Evidence({
  data,
  locale,
  title,
}: {
  data: OrderCaseEvidence;
  locale: "ru" | "en";
  title: string;
}) {
  const copy = orderCaseCopy(locale);
  return (
    <section className="nexus-panel space-y-3 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p>
        {financialOrderLabel(locale, data.orderStatus)} ·{" "}
        {formatHistoryAmount(data.totalAmount, data.currency, locale)}
      </p>
      <p className="text-sm text-secondary">
        {copy.items}: {data.itemCount} · {copy.payments}: {data.paymentCount} · {copy.captures}:{" "}
        {data.recordedCaptureCount} · {copy.refunded}: {data.refundedRecordCount} · {copy.disputed}:{" "}
        {data.disputedRecordCount}
      </p>
      <p className="text-xs text-muted">
        {copy.captured}:{" "}
        <time dateTime={data.capturedAt}>
          {formatHistoryDate(new Date(data.capturedAt), locale)}
        </time>
      </p>
      {data.payments.length ? (
        <ul className="space-y-2 text-sm">
          {data.payments.map((payment) => (
            <li key={payment.recordKey}>
              {financialPaymentLabel(locale, payment.status)} ·{" "}
              {formatHistoryAmount(payment.amount, payment.currency, locale)} ·{" "}
              <time dateTime={payment.createdAt}>
                {formatHistoryDate(new Date(payment.createdAt), locale)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary">{copy.noPayments}</p>
      )}
      {data.paymentCount > data.payments.length && (
        <p className="text-xs text-muted">
          {data.payments.length} / {data.paymentCount}
        </p>
      )}
    </section>
  );
}
function Pagination({
  page,
  totalPages,
  locale,
  query = {},
}: {
  page: number;
  totalPages: number;
  locale: string;
  query?: Query;
}) {
  if (totalPages <= 1) return null;
  const copy = orderCaseCopy(locale),
    href = (next: number) => {
      const params = new URLSearchParams();
      for (const key of ["reviewStatus", "threadStatus"])
        if (typeof query[key] === "string" && query[key]) params.set(key, query[key]);
      params.set("page", String(next));
      return `?${params}`;
    };
  return (
    <nav aria-label={copy.page} className="flex gap-4 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-accent underline">
          {copy.previous}
        </Link>
      )}
      <span>
        {copy.page} {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className="text-accent underline">
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
export async function OrderCaseCreatePage({ orderId }: { orderId: string }) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = orderCaseCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <HistorySignIn copy={getCommerceHistoryCopy(locale)} />;
  const result = await orderCaseService.orderDetail(orderId, actor).catch(scopedError);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={`/workspace/purchases/${encodeURIComponent(orderId)}`}
        className="text-sm text-accent underline"
      >
        {copy.order}: {result.order.orderNumber}
      </Link>
      <h1 className="font-display text-primary">{copy.create}</h1>
      <p className="text-sm text-secondary">{copy.intro}</p>
      <p role="note" className="text-sm text-secondary">
        {copy.financeNote}
      </p>
      <Evidence data={result.evidence} locale={locale} title={copy.current} />
      {result.existingCase ? (
        <Link
          href={`/workspace/order-cases/${encodeURIComponent(result.existingCase.id)}`}
          className="text-accent underline"
        >
          {copy.existing} · {orderCaseStatusLabel(locale, result.existingCase.reviewStatus)}
        </Link>
      ) : (
        <OrderCaseCreateForm
          orderId={orderId}
          total={result.order.totalAmount}
          currency={result.order.currency}
          locale={locale}
        />
      )}
    </div>
  );
}
export async function OrderCaseListPage({
  staff = false,
  query,
}: {
  staff?: boolean;
  query: Query;
}) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = orderCaseCopy(locale),
    base = staff ? "/admin/commerce/order-cases" : "/workspace/order-cases";
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <HistorySignIn copy={getCommerceHistoryCopy(locale)} />;
  let filters: ReturnType<typeof orderCasePageQuery>;
  try {
    filters = orderCasePageQuery(query, true);
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 400) throw error;
    return (
      <p className="py-8">
        {copy.invalidQuery}{" "}
        <Link href={base} className="text-accent underline">
          {copy.clear}
        </Link>
      </p>
    );
  }
  const result = await orderCaseService
    .page(actor, staff, filters.page, filters)
    .catch(scopedError);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={staff ? "/admin" : "/workspace/purchases"}
        className="text-sm text-accent underline"
      >
        {staff ? copy.review : copy.order}
      </Link>
      <h1 className="font-display text-primary">{staff ? copy.queue : copy.buyerCases}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.financeNote}
      </p>
      <form action={base} className="flex flex-wrap items-end gap-3" aria-label={copy.filters}>
        <label className="space-y-2">
          <span className="block text-sm">{copy.status}</span>
          <select
            name="reviewStatus"
            defaultValue={filters.reviewStatus ?? ""}
            className="rounded-lg border border-base bg-surface p-2 text-sm"
          >
            <option value="">{copy.all}</option>
            {ORDER_CASE_REVIEW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {orderCaseStatusLabel(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="block text-sm">{copy.thread}</span>
          <select
            name="threadStatus"
            defaultValue={filters.threadStatus ?? ""}
            className="rounded-lg border border-base bg-surface p-2 text-sm"
          >
            <option value="">{copy.all}</option>
            {(["open", "resolved", "closed"] as const).map((value) => (
              <option key={value} value={value}>
                {orderCaseThreadLabel(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" size="sm">
          {copy.apply}
        </Button>
        <Link href={base} className="p-2 text-sm text-accent underline">
          {copy.clear}
        </Link>
      </form>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((item) => (
            <li key={item.id} className="nexus-panel space-y-2 p-5">
              <Link
                href={`${base}/${encodeURIComponent(item.id)}`}
                className="break-words font-semibold text-accent underline"
              >
                {item.subject}
              </Link>
              <p className="text-sm">
                {copy.order}: {item.orderNumber} · {orderCaseKindLabel(locale, item.kind)}
              </p>
              <p className="text-sm text-secondary">
                {orderCaseStatusLabel(locale, item.reviewStatus)} · {copy.thread}:{" "}
                {orderCaseThreadLabel(locale, item.threadStatus)}
              </p>
              {item.requestedAmount !== null && (
                <p className="text-sm">
                  {copy.requested}:{" "}
                  {formatHistoryAmount(item.requestedAmount, item.currency, locale)}
                </p>
              )}
              <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(item.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} locale={locale} query={query} />
    </div>
  );
}
export async function OrderCaseDetailPage({
  caseId,
  staff = false,
  query,
}: {
  caseId: string;
  staff?: boolean;
  query: Query;
}) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = orderCaseCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <HistorySignIn copy={getCommerceHistoryCopy(locale)} />;
  let page = 1;
  try {
    page = orderCasePageQuery(query).page;
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 400) throw error;
    notFound();
  }
  const result = await orderCaseService.detail(caseId, actor, staff, page).catch(scopedError),
    current = result.current;
  const monetary =
    ["refund_request", "dispute"].includes(result.case.kind) &&
    result.case.requestedAmount !== null;
  const eligible =
    current.orderStatus === "completed" &&
    current.currency === result.case.currency &&
    result.case.requestedAmount !== null &&
    result.case.requestedAmount <= current.totalAmount &&
    current.recordedCaptureCount === 1 &&
    current.recordedMatchingCaptureCount === 1 &&
    current.refundedRecordCount === 0 &&
    current.disputedRecordCount === 0;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={staff ? "/admin/commerce/order-cases" : "/workspace/order-cases"}
        className="text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">{result.case.subject}</h1>
      <p>
        {copy.order}: {result.order.orderNumber} · {orderCaseKindLabel(locale, result.case.kind)}
      </p>
      <p className="text-sm text-secondary">
        {orderCaseStatusLabel(locale, result.case.reviewStatus)} · {copy.thread}:{" "}
        {orderCaseThreadLabel(locale, result.case.threadStatus)}
      </p>
      {result.case.requestedAmount !== null && (
        <p>
          {copy.requested}:{" "}
          {formatHistoryAmount(result.case.requestedAmount, result.case.currency, locale)}
        </p>
      )}
      <p role="note" className="rounded-lg border border-base p-4 text-sm text-secondary">
        {copy.financeNote}
      </p>
      {result.evidenceChanged && (
        <p role="note" className="text-sm text-warning">
          {copy.changed}
        </p>
      )}
      <Evidence data={result.snapshot} locale={locale} title={copy.snapshot} />
      <Evidence data={current} locale={locale} title={copy.current} />
      {staff && actor.role === "admin" && (
        <Link
          href={`/admin/commerce/reconciliation/${encodeURIComponent(result.order.id)}`}
          className="text-sm text-accent underline"
        >
          {copy.reconcile}
        </Link>
      )}
      {staff &&
        (result.canReview ? (
          <OrderCaseReviewForm
            caseId={caseId}
            reviewStatus={result.case.reviewStatus}
            revision={result.case.revision}
            supportUpdatedAt={result.case.supportUpdatedAt.toISOString()}
            evidenceHash={result.evidenceHash}
            threadStatus={result.case.threadStatus}
            canRecommendRefund={result.canRecommendRefund}
            monetary={monetary}
            recommendationEligible={eligible}
            locale={locale}
          />
        ) : (
          <p className="text-sm text-secondary">{copy.independent}</p>
        ))}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{copy.history}</h2>
        <ol className="space-y-3">
          {result.history.map((event) => (
            <li key={event.id} className="nexus-panel space-y-2 p-4">
              <p className="text-sm">{orderCaseStatusLabel(locale, event.reviewStatus)}</p>
              {event.notes && (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {event.notes}
                </p>
              )}
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
        <Pagination page={result.page} totalPages={result.totalPages} locale={locale} />
      </section>
      <SupportCaseThread
        key={`${caseId}:${result.case.supportUpdatedAt.toISOString()}`}
        caseId={caseId}
        staffMode={staff}
      />
    </div>
  );
}
