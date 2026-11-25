import {
  AppError,
  type ExplicitFxRate,
  ORDER_CASE_REVIEW_STATUSES,
  type OrderCaseEvidence,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { orderCaseService } from "../../../lib/services/commerce/order-case-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelSpace2P4, panelSpace2P5, panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { surfaceP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeBlockSm,
  typeBreakDisplayPrimary,
  typeDisplayPrimary,
  typeFlexGap4Sm,
  typeFlexWrapEndGap3,
  typeLgSemibold,
  typePrewrapSmSecondary,
  typeSmSecondary,
  typeSpace2Sm,
  typeXsMuted,
} from "../../shell/type-shell";
import { SupportCaseThread } from "../../support/thread";
import { formatHistoryAmount, formatHistoryDate } from "../commerce-history-format";
import { OrderCaseCreateForm, OrderCaseReviewForm } from "../components/order-case-forms";
import { RecordedRateEstimate } from "../components/recorded-rate-estimate";
import { WalletOrderRefundForm } from "../components/wallet-order-refund-form";
import {
  commercialProviderLabel,
  financialOrderLabel,
  financialPaymentLabel,
} from "../financial-i18n";
import {
  orderCaseCopy,
  orderCaseKindLabel,
  orderCaseStatusLabel,
  orderCaseThreadLabel,
} from "../order-case-i18n";
import { orderCasePageQuery } from "../order-case-query";
export async function orderCaseMetadata(staff = false): Promise<Metadata> {
  const copy = orderCaseCopy(await getRequestLocale());
  return {
    title: `${staff ? copy.queue : copy.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
type Query = Record<string, string | string[] | undefined>;
function orderCaseAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}
function OrderCaseLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
}: {
  locale: Locale;
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = orderCaseCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <div className={pageShellMax4xl}>
      <Link href={backHref} className={linkAccentSmRounded}>
        {backLabel}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccentSmRounded}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </div>
  );
}
async function caseRates() {
  if (!isWalletEngineEnabled()) return undefined;
  return new WalletPaymentService().listFxRates().catch(() => null);
}

function Evidence({
  data,
  locale,
  rates,
  title,
}: {
  data: OrderCaseEvidence;
  locale: "ru" | "en";
  rates?: readonly ExplicitFxRate[] | null;
  title: string;
}) {
  const copy = orderCaseCopy(locale);
  return (
    <section className={panelSpace3P5}>
      <h2 className={typeLgSemibold}>{title}</h2>
      <p>
        {financialOrderLabel(locale, data.orderStatus)} ·{" "}
        {formatHistoryAmount(data.totalAmount, data.currency, locale)}
        <RecordedRateEstimate
          amount={data.totalAmount}
          currency={data.currency}
          locale={locale}
          rates={rates}
        />
      </p>
      <p className={typeSmSecondary}>
        {copy.items}: {data.itemCount} · {copy.payments}: {data.paymentCount} · {copy.captures}:{" "}
        {data.recordedCaptureCount} · {copy.refunded}: {data.refundedRecordCount} · {copy.disputed}:{" "}
        {data.disputedRecordCount}
      </p>
      <p className={typeXsMuted}>
        {copy.captured}:{" "}
        <time dateTime={data.capturedAt}>
          {formatHistoryDate(new Date(data.capturedAt), locale)}
        </time>
      </p>
      {data.payments.length ? (
        <ul className={typeSpace2Sm}>
          {data.payments.map((payment) => (
            <li key={payment.recordKey}>
              {financialPaymentLabel(locale, payment.status)} ·{" "}
              {formatHistoryAmount(payment.amount, payment.currency, locale)}
              <RecordedRateEstimate
                amount={payment.amount}
                currency={payment.currency}
                locale={locale}
                rates={rates}
              />
              · {copy.provider}: {commercialProviderLabel(locale, payment.provider)} ·{" "}
              <time dateTime={payment.createdAt}>
                {formatHistoryDate(new Date(payment.createdAt), locale)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={copy.noPayments} description={copy.noPaymentsHint} />
      )}
      {data.paymentCount > data.payments.length && (
        <p className={typeXsMuted}>
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
  locale: Locale;
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
    <nav aria-label={copy.page} className={typeFlexGap4Sm}>
      {page > 1 && (
        <Link href={href(page - 1)} className={linkAccentSmRounded}>
          {copy.previous}
        </Link>
      )}
      <span>
        {copy.page} {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className={linkAccentSmRounded}>
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
export async function OrderCaseCreatePage({ orderId }: { orderId: string }) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]),
    copy = orderCaseCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/purchases/"}
      />
    );
  }

  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/purchases/${encodeURIComponent(orderId)}/support`}
      />
    );
  const orderPath = `/workspace/purchases/${encodeURIComponent(orderId)}`;
  const retryHref = `${orderPath}/support`;
  let result: Awaited<ReturnType<typeof orderCaseService.orderDetail>> | null = null;
  try {
    result = await orderCaseService.orderDetail(orderId, actor);
  } catch (error) {
    if (orderCaseAccessError(error) === "missing") notFound();
    return (
      <OrderCaseLoadError
        locale={locale}
        backHref={orderPath}
        backLabel={copy.order}
        retryHref={retryHref}
      />
    );
  }
  const rates = await caseRates();
  return (
    <div className={pageShellMax4xl}>
      <Link href={orderPath} className={linkAccentSmRounded}>
        {copy.order}: {result.order.orderNumber}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.create}</h1>
      <p className={typeSmSecondary}>{copy.intro}</p>
      <p role="note" className={typeSmSecondary}>
        {copy.financeNote}
      </p>
      <Evidence data={result.evidence} locale={locale} rates={rates} title={copy.current} />
      {result.existingCase ? (
        <Link
          href={`/workspace/order-cases/${encodeURIComponent(result.existingCase.id)}`}
          className={linkAccentSmRounded}
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
  if (!actor) {
    const pageParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") pageParams.set(key, value);
    }
    const returnPath = `${base}${pageParams.size ? `?${pageParams}` : ""}`;
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let filters: ReturnType<typeof orderCasePageQuery>;
  try {
    filters = orderCasePageQuery(query, true);
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 400) throw error;
    return (
      <p className="py-8">
        {copy.invalidQuery}{" "}
        <Link href={base} className={linkAccentSmRounded}>
          {copy.clear}
        </Link>
      </p>
    );
  }
  const result = await orderCaseService.page(actor, staff, filters.page, filters).catch((error) => {
    if (orderCaseAccessError(error) === "missing") notFound();
    return null;
  });
  const filtersActive = Boolean(filters.reviewStatus || filters.threadStatus);
  const retryHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    return `${base}${params.size ? `?${params}` : ""}`;
  })();
  if (!result) {
    return (
      <OrderCaseLoadError
        locale={locale}
        backHref={staff ? "/admin" : "/workspace/purchases"}
        backLabel={staff ? copy.review : copy.order}
        retryHref={retryHref}
      />
    );
  }
  return (
    <div className={pageShellMax4xl}>
      <Link href={staff ? "/admin" : "/workspace/purchases"} className={linkAccentSmRounded}>
        {staff ? copy.review : copy.order}
      </Link>
      <h1 className={typeDisplayPrimary}>{staff ? copy.queue : copy.buyerCases}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.financeNote}
      </p>
      {staff && filters.reviewStatus === "refund_recommended" ? (
        <p role="note" className={typeSmSecondary}>
          {copy.refundInspectNote}
        </p>
      ) : null}
      <search aria-label={copy.filters}>
        <form action={base} className={typeFlexWrapEndGap3}>
          <label className="space-y-2">
            <span className={typeBlockSm}>{copy.status}</span>
            <select
              name="reviewStatus"
              defaultValue={filters.reviewStatus ?? ""}
              className="min-h-11 rounded-lg border border-base bg-surface p-2 text-sm"
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
            <span className={typeBlockSm}>{copy.thread}</span>
            <select
              name="threadStatus"
              defaultValue={filters.threadStatus ?? ""}
              className="min-h-11 rounded-lg border border-base bg-surface p-2 text-sm"
            >
              <option value="">{copy.all}</option>
              {(["open", "resolved", "closed"] as const).map((value) => (
                <option key={value} value={value}>
                  {orderCaseThreadLabel(locale, value)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" size="touch">
            {copy.apply}
          </Button>
          <Link href={base} className={linkAccentSmRounded}>
            {copy.clear}
          </Link>
        </form>
      </search>
      {result.items.length ? (
        await (async () => {
          const rates = await caseRates();
          return (
            <ol className="space-y-3">
              {result.items.map((item) => {
                const engineOn = isWalletEngineEnabled();
                const reconciliationEligible =
                  item.orderStatus === "completed" &&
                  item.currency === item.orderCurrency &&
                  item.requestedAmount !== null &&
                  item.requestedAmount <= item.orderTotalAmount &&
                  item.recordedCaptureCount === 1 &&
                  item.recordedMatchingCaptureCount === 1 &&
                  item.refundedRecordCount === 0 &&
                  item.disputedRecordCount === 0;
                const walletExecutable =
                  reconciliationEligible && item.paymentProvider === "wallet" && engineOn;
                return (
                  <li key={item.id} className={panelSpace2P5}>
                    <Link
                      href={`${base}/${encodeURIComponent(item.id)}`}
                      className={`break-words font-semibold ${linkAccentSmRounded}`}
                    >
                      {item.subject}
                    </Link>
                    <p className="text-sm">
                      {copy.order}: {item.orderNumber} · {orderCaseKindLabel(locale, item.kind)}
                    </p>
                    <p className={typeSmSecondary}>
                      {orderCaseStatusLabel(locale, item.reviewStatus)} · {copy.thread}:{" "}
                      {orderCaseThreadLabel(locale, item.threadStatus)}
                    </p>
                    {staff ? (
                      <p className={typeSmSecondary}>
                        {copy.orderStatus}: {financialOrderLabel(locale, item.orderStatus)}
                        {item.paymentProvider
                          ? ` · ${copy.provider}: ${commercialProviderLabel(locale, item.paymentProvider)}`
                          : ""}
                      </p>
                    ) : null}
                    {staff && item.reviewStatus === "refund_recommended" ? (
                      <p role="note" className={typeXsMuted}>
                        {!engineOn
                          ? copy.walletRefundEngineOff
                          : walletExecutable
                            ? copy.walletRefundExecutable
                            : item.paymentProvider && item.paymentProvider !== "wallet"
                              ? copy.walletRefundNotWallet
                              : copy.walletRefundNotExecutable}
                      </p>
                    ) : null}
                    {item.requestedAmount !== null && (
                      <p className="text-sm">
                        {copy.requested}:{" "}
                        {formatHistoryAmount(item.requestedAmount, item.currency, locale)}
                        <RecordedRateEstimate
                          amount={item.requestedAmount}
                          currency={item.currency}
                          locale={locale}
                          rates={rates}
                        />
                      </p>
                    )}
                    <time dateTime={item.createdAt.toISOString()} className={typeXsMuted}>
                      {formatHistoryDate(item.createdAt, locale)}
                    </time>
                  </li>
                );
              })}
            </ol>
          );
        })()
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clear : copy.financeNote}
          icon={<LifeBuoy className="h-6 w-6" aria-hidden="true" />}
          action={
            <Link href={base} className={linkAccentSmRounded}>
              {copy.clear}
            </Link>
          }
        />
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
  if (!actor) {
    const detailBase = staff
      ? `/admin/commerce/order-cases/${encodeURIComponent(caseId)}`
      : `/workspace/order-cases/${encodeURIComponent(caseId)}`;
    const pageParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") pageParams.set(key, value);
    }
    const returnPath = `${detailBase}${pageParams.size ? `?${pageParams}` : ""}`;
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let page = 1;
  try {
    page = orderCasePageQuery(query).page;
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 400) throw error;
    notFound();
  }
  const detailBase = staff
    ? `/admin/commerce/order-cases/${encodeURIComponent(caseId)}`
    : `/workspace/order-cases/${encodeURIComponent(caseId)}`;
  const listBase = staff ? "/admin/commerce/order-cases" : "/workspace/order-cases";
  const retryHref = (() => {
    const pageParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") pageParams.set(key, value);
    }
    return `${detailBase}${pageParams.size ? `?${pageParams}` : ""}`;
  })();
  const result = await orderCaseService.detail(caseId, actor, staff, page).catch((error) => {
    if (orderCaseAccessError(error) === "missing") notFound();
    return null;
  });
  if (!result) {
    return (
      <OrderCaseLoadError
        locale={locale}
        backHref={listBase}
        backLabel={copy.back}
        retryHref={retryHref}
      />
    );
  }
  const current = result.current;
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
  const rates = await caseRates();
  return (
    <div className={pageShellMax4xl}>
      <Link href={listBase} className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <h1 className={typeBreakDisplayPrimary}>{result.case.subject}</h1>
      <p>
        {copy.order}: {result.order.orderNumber} · {orderCaseKindLabel(locale, result.case.kind)}
      </p>
      <p className={typeSmSecondary}>
        {orderCaseStatusLabel(locale, result.case.reviewStatus)} · {copy.thread}:{" "}
        {orderCaseThreadLabel(locale, result.case.threadStatus)}
      </p>
      {result.case.requestedAmount !== null && (
        <p>
          {copy.requested}:{" "}
          {formatHistoryAmount(result.case.requestedAmount, result.case.currency, locale)}
          <RecordedRateEstimate
            amount={result.case.requestedAmount}
            currency={result.case.currency}
            locale={locale}
            rates={rates}
          />
        </p>
      )}
      <p role="note" className={surfaceP4TextSmSecondary}>
        {copy.financeNote}
      </p>
      {result.evidenceChanged ? (
        <ErrorState
          id="order-case-evidence-changed"
          title={copy.changed}
          description={copy.changedHint}
        />
      ) : null}
      <Evidence data={result.snapshot} locale={locale} rates={rates} title={copy.snapshot} />
      <Evidence data={current} locale={locale} rates={rates} title={copy.current} />
      {staff && actor.role === "admin" && (
        <Link
          href={`/admin/commerce/reconciliation/${encodeURIComponent(result.order.id)}`}
          className={linkAccentSmRounded}
        >
          {copy.reconcile}
        </Link>
      )}
      {staff &&
        (result.canReview ? (
          <OrderCaseReviewForm
            key={`${actor.id}:${caseId}:${result.case.revision}:${result.case.supportUpdatedAt.toISOString()}`}
            actorId={actor.id}
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
          <p className={typeSmSecondary}>{copy.independent}</p>
        ))}
      {staff &&
      actor.role === "admin" &&
      isWalletEngineEnabled() &&
      eligible &&
      result.case.reviewStatus === "refund_recommended" ? (
        <WalletOrderRefundForm actorId={actor.id} orderId={result.order.id} />
      ) : null}
      <section className="space-y-3">
        <h2 className={typeLgSemibold}>{copy.history}</h2>
        <ol className="space-y-3">
          {result.history.map((event) => (
            <li key={event.id} className={panelSpace2P4}>
              <p className="text-sm">{orderCaseStatusLabel(locale, event.reviewStatus)}</p>
              {event.notes && <p className={typePrewrapSmSecondary}>{event.notes}</p>}
              <time dateTime={event.createdAt.toISOString()} className={typeXsMuted}>
                {formatHistoryDate(event.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
        <Pagination page={result.page} totalPages={result.totalPages} locale={locale} />
      </section>
      <SupportCaseThread
        key={`${actor.id}:${caseId}:${result.case.supportUpdatedAt.toISOString()}`}
        caseId={caseId}
        actorId={actor.id}
        staffMode={staff}
      />
    </div>
  );
}

export const memberOrderCaseMetadata = () => orderCaseMetadata(false);
export const staffOrderCaseMetadata = () => orderCaseMetadata(true);

export async function MemberOrderCaseListPage({ searchParams }: { searchParams: Promise<Query> }) {
  return OrderCaseListPage({ query: await searchParams });
}

export async function StaffOrderCaseListPage({ searchParams }: { searchParams: Promise<Query> }) {
  return OrderCaseListPage({ staff: true, query: await searchParams });
}

export async function MemberOrderCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return OrderCaseDetailPage({ caseId: id, query });
}

export async function StaffOrderCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return OrderCaseDetailPage({ staff: true, caseId: id, query });
}

export async function PurchaseOrderCaseCreatePage({ params }: { params: Promise<{ id: string }> }) {
  return OrderCaseCreatePage({ orderId: (await params).id });
}
