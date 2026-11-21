import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { orderOperationsService } from "../../../lib/services/commerce/commercial-plan-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { surfaceBgP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeBreakSecondary,
  typeDisplayPrimary,
  typeFlexGap4Sm,
  typeGridGap3Sm2,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../commerce-history-format";
import { getCommercialCopy } from "../commercial-i18n";
import { commercialProviderLabel } from "../financial-i18n";
import { OrderCancellationForm } from "../order-cancellation";
import { getWalletCopy } from "../wallet-i18n";
import { WalletPayOrderForm } from "../wallet-pay";
export async function purchaseOperationsMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).paymentOperations} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PurchaseOperationsScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getCommercialCopy(locale),
    dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
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

  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/purchases/${encodeURIComponent(id)}/operations`}
      />
    );
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000),
    returnHref = `/workspace/purchases/${encodeURIComponent(id)}/operations${pageNumber > 1 ? `?page=${pageNumber}` : ""}`;
  const result = await orderOperationsService.detail(user, id, pageNumber).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link
          href={`/workspace/purchases/${encodeURIComponent(id)}`}
          className={linkAccentSmRounded}
        >
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const states = {
    processing: copy.processing,
    pending: copy.pending,
    authorized: copy.authorized,
    completed: copy.completed,
    failed: copy.failed,
    refunded: copy.refunded,
    partially_refunded: copy.partially_refunded,
    disputed: copy.disputed,
    cancelled: copy.cancelledPayment,
  };
  const status = (value: string) =>
    Object.hasOwn(states, value) ? states[value as keyof typeof states] : copy.unknown;
  const hasWalletAttempt = result.attempts.some((attempt) => attempt.provider === "wallet");
  return (
    <div className={pageShellMax4xl}>
      <Link href={`/workspace/purchases/${encodeURIComponent(id)}`} className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.paymentOperations}</h1>
      <p className={typeBreakSecondary}>
        {result.order.orderNumber} · {status(result.order.status)}
      </p>
      <p role="note" className={surfaceBgP4TextSmSecondary}>
        {hasWalletAttempt ? copy.walletOperationsNote : copy.operationsNote}
      </p>
      {isWalletEngineEnabled() && result.order.status === "pending" && result.canCancel ? (
        <WalletPayOrderForm
          key={`wallet:${user.id}:${id}`}
          actorId={user.id}
          orderId={id}
          amountLabel={`${getWalletCopy(locale === "ru" ? "ru" : "en").paySubmit}: ${formatHistoryAmount(result.order.totalAmount, result.order.currency, locale === "ru" ? "ru" : "en")}`}
          amountMinor={result.order.totalAmount}
          currency={result.order.currency}
          canPay
        />
      ) : null}
      <OrderCancellationForm
        key={`${user.id}:${id}`}
        actorId={user.id}
        orderId={id}
        expectedUpdatedAt={result.order.updatedAt.toISOString()}
        canCancel={result.canCancel}
      />
      {!result.canCancel ? (
        <ErrorState
          id="order-operations-cannot-cancel"
          title={
            result.order.status === "cancelled"
              ? copy.cancelledPayment
              : hasWalletAttempt
                ? copy.cannotCancelWallet
                : copy.cannotCancel
          }
          description={hasWalletAttempt ? copy.cannotCancelWalletHint : copy.cannotCancelHint}
        />
      ) : null}
      <section aria-labelledby="payment-attempts" className="space-y-4">
        <h2 id="payment-attempts" className={typeXlSemiboldPrimary}>
          {copy.attempts} ({result.total})
        </h2>
        {result.attempts.length ? (
          <ol className="space-y-3">
            {result.attempts.map((attempt) => (
              <li key={attempt.id} className={panelSpace3P5}>
                <p className="text-primary">
                  {copy.status}: {status(attempt.status)}
                </p>
                <p className="text-secondary">
                  {copy.provider}: {commercialProviderLabel(locale, attempt.provider)}
                </p>
                <p className="font-numeric text-secondary">
                  {copy.amount}: {formatHistoryAmount(attempt.amount, attempt.currency, locale)}
                </p>
                <dl className={typeGridGap3Sm2}>
                  {(["createdAt", "updatedAt"] as const).map((key) => (
                    <div key={key}>
                      <dt className="text-muted">{copy[key]}</dt>
                      <dd>
                        <time dateTime={attempt[key].toISOString()}>
                          {formatHistoryDate(attempt[key], locale)}
                        </time>
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-secondary">{copy.noAttempts}</p>
        )}
      </section>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexGap4Sm}>
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
