import type { ExplicitFxRate } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../lib/services/commerce/commerce-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { getResourceCommerceCopy } from "../../resources/resource-commerce-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { surfaceBgP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeMinBreakDisplayPrimary,
  typeMinBreakSemiboldPrimary,
  typeMinSpace4,
  typeNumericPrimary,
  typeSmMuted,
  typeSmSecondary,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../commerce-history-format";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getCommercialCopy } from "../commercial-i18n";
import { RecordedRateEstimate } from "../components/recorded-rate-estimate";
import { orderCaseCopy } from "../order-case-i18n";
import { orderTermsCopy } from "../order-terms-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { WalletPayOrderForm } from "../wallet-pay";

function OrderAmountEstimate({
  amount,
  currency,
  locale,
  rates,
  purpose = "amount",
}: {
  amount: number;
  currency: string;
  locale: "en" | "ru";
  rates: readonly ExplicitFxRate[] | null | undefined;
  purpose?: "amount" | "discount";
}) {
  if (rates == null) return null;
  return (
    <RecordedRateEstimate
      amount={amount}
      currency={currency}
      locale={locale}
      purpose={purpose}
      rates={rates}
    />
  );
}
export async function purchaseDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).orderDetailsTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PurchaseDetailScreen({
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
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  const dictionary = getDictionary(typedLocale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={getDictionary(typedLocale).errors.message}
        retryHref={"/workspace/purchases/"}
      />
    );
  }

  if (!actor)
    return (
      <PlatformSignIn
        locale={typedLocale}
        returnPath={`/workspace/purchases/${encodeURIComponent(id)}`}
      />
    );
  const page = parseHistoryPage(query.page);
  const retryHref = `/workspace/purchases/${encodeURIComponent(id)}${
    page > 1 ? `?page=${encodeURIComponent(String(page))}` : ""
  }`;
  let result: Awaited<ReturnType<typeof commerceService.getBuyerOrderDetails>>;
  try {
    result = await commerceService.getBuyerOrderDetails(actor, id, page);
  } catch {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/workspace/purchases" className={linkAccentSmRounded}>
          {copy.backToPurchases}
        </Link>
        <ErrorState
          title={copy.orderLoadUnavailable}
          description={copy.orderLoadUnavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!result) notFound();
  const { order, items, walletSettled } = result;
  const walletEnabled = isWalletEngineEnabled();
  const fxRates = walletEnabled
    ? await new WalletPaymentService().listFxRates().catch(() => null)
    : undefined;
  const canPayWithWallet = walletEnabled && order.status === "pending" && order.totalAmount > 0;
  const walletCopy = getWalletCopy(typedLocale);
  return (
    <div className={pageShellMax4xl}>
      <header className="min-w-0 space-y-3 border-b border-base pb-5">
        <Link href="/workspace/purchases" className={linkAccentSmRounded}>
          {copy.backToPurchases}
        </Link>
        <h1 className={typeMinBreakDisplayPrimary}>
          {copy.orderNumber}: {order.orderNumber}
        </h1>
        <p className="text-secondary">
          {copy.status}: {orderStatusLabel(order.status, copy.orderStatuses)}
        </p>
        {fxRates === null ? (
          <p role="note" className={typeSmMuted}>
            {walletCopy.recordedRateUnavailable}
          </p>
        ) : null}
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-muted">{copy.placed}</dt>
            <dd className="text-primary">
              <time dateTime={order.createdAt.toISOString()}>
                {formatHistoryDate(order.createdAt, typedLocale)}
              </time>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted">{copy.total}</dt>
            <dd className={typeNumericPrimary}>
              {formatHistoryAmount(order.totalAmount, order.currency, typedLocale)}
            </dd>
            {fxRates !== undefined ? (
              <OrderAmountEstimate
                amount={order.totalAmount}
                currency={order.currency}
                locale={typedLocale}
                rates={fxRates}
              />
            ) : null}
          </div>
          {order.promoCode && order.listAmount != null && order.discountAmount != null ? (
            <>
              <div className="min-w-0">
                <dt className="text-muted">{walletCopy.promoList}</dt>
                <dd className="text-primary">
                  {formatHistoryAmount(order.listAmount, order.currency, typedLocale)}
                </dd>
                {fxRates !== undefined ? (
                  <OrderAmountEstimate
                    amount={order.listAmount}
                    currency={order.currency}
                    locale={typedLocale}
                    rates={fxRates}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <dt className="text-muted">{walletCopy.promoDiscount}</dt>
                <dd className="text-primary">
                  {walletCopy.promoApplied
                    .replace("{code}", order.promoCode)
                    .replace(
                      "{discount}",
                      formatHistoryAmount(order.discountAmount, order.currency, typedLocale),
                    )
                    .replace(
                      "{charged}",
                      formatHistoryAmount(order.totalAmount, order.currency, typedLocale),
                    )}
                </dd>
                {fxRates !== undefined ? (
                  <OrderAmountEstimate
                    amount={order.discountAmount}
                    currency={order.currency}
                    locale={typedLocale}
                    purpose="discount"
                    rates={fxRates}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </dl>
      </header>
      {canPayWithWallet ? (
        <WalletPayOrderForm
          key={`${actor.id}:${id}`}
          actorId={actor.id}
          orderId={id}
          amountLabel={`${walletCopy.payTitle}: ${formatHistoryAmount(order.totalAmount, order.currency, typedLocale)}`}
          amountMinor={order.totalAmount}
          currency={order.currency}
          canPay={canPayWithWallet}
          rates={fxRates}
        />
      ) : null}
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/operations`}
        className={linkAccentSmRounded}
      >
        {getCommercialCopy(typedLocale).paymentOperations}
      </Link>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/support`}
        className={linkAccentSmRounded}
      >
        {orderCaseCopy(typedLocale).title}
      </Link>
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}/terms`}
        className={linkAccentSmRounded}
      >
        {orderTermsCopy(typedLocale).title}
      </Link>
      <p role="note" className={surfaceBgP4TextSmSecondary}>
        {walletSettled ? copy.walletReceiptNote : copy.receiptNote}
      </p>
      <section className={typeMinSpace4} aria-labelledby="order-items">
        <h2 id="order-items" className={typeXlSemiboldPrimary}>
          {copy.lineItems} ({result.total})
        </h2>
        {fxRates === null ? (
          <p role="note" className={typeSmMuted}>
            {walletCopy.recordedRateUnavailable}
          </p>
        ) : null}
        {items.length === 0 ? (
          <EmptyState
            title={copy.emptyItems}
            description={copy.emptyItemsHint}
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className={panelMinSpace3P5}>
                <h3 className={typeMinBreakSemiboldPrimary}>
                  {item.productTitle ?? copy.unavailableResource}
                </h3>
                <p className={typeSmSecondary}>
                  {copy.linePrice}:{" "}
                  {formatHistoryAmount(item.unitPrice, item.currency, typedLocale)}
                </p>
                {fxRates !== undefined ? (
                  <OrderAmountEstimate
                    amount={item.unitPrice}
                    currency={item.currency}
                    locale={typedLocale}
                    rates={fxRates}
                  />
                ) : null}
                <p className={typeSmMuted}>
                  {item.hasCurrentAccess ? copy.accessReady : copy.accessMissing}
                </p>
                {item.purchasedBuildId || item.purchasedVersion ? (
                  <div className="space-y-1" data-purchased-build-evidence="">
                    <p className={typeSmSecondary}>
                      {copy.purchasedBuildEvidence}
                      {item.purchasedVersion ? `: v${item.purchasedVersion}` : ""}
                      {item.purchasedBuildId ? (
                        <>
                          {" "}
                          <code className="break-all text-xs">{item.purchasedBuildId}</code>
                        </>
                      ) : null}
                    </p>
                    <p className={typeSmMuted}>{copy.purchasedBuildEvidenceHint}</p>
                  </div>
                ) : null}
                {item.hasCurrentAccess && (
                  <Link href="/workspace/library" className={linkAccentSmRounded}>
                    {getResourceCommerceCopy(typedLocale).library}
                  </Link>
                )}
                {item.productSlug && (
                  <Link href={`/market/${item.productSlug}`} className={linkAccentSmRounded}>
                    {copy.openResource}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex min-w-0 flex-wrap gap-4 text-sm text-secondary">
          {result.page > 1 && (
            <Link href={`?page=${result.page - 1}`} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
