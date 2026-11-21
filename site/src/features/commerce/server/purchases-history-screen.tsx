import { orderRepository } from "@nexus/db";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellClip } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeFlexMinWrapStartBetweenGap3,
  typeGridMinGap3Sm2,
  typeMinBreakBaseSemiboldPrimary,
  typeNumericSemiboldPrimary,
  typeRoundedBorderPx2Py1XsSecondary,
} from "../../shell/type-shell";
import {
  formatHistoryAmount,
  formatHistoryDate,
  orderStatusLabel,
  parseHistoryPage,
} from "../commerce-history-format";
import { commerceHistoryBetaNotice, getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getCommercialCopy } from "../commercial-i18n";
import { orderCaseCopy } from "../order-case-i18n";
import { HistoryPagination, HistoryShell } from "../workspace-history";
export async function purchasesHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).purchasesTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PurchasesHistoryScreen({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  const historyNotice = commerceHistoryBetaNotice(typedLocale, isWalletEngineEnabled());
  const dictionary = getDictionary(typedLocale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={copy.purchasesLoadUnavailable}
        retryHref={"/workspace/purchases"}
      />
    );
  }

  if (!user) {
    const page = typeof query.page === "string" ? query.page : undefined;
    const returnPath =
      page && page !== "1"
        ? `/workspace/purchases?page=${encodeURIComponent(page)}`
        : "/workspace/purchases";
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }

  const page = parseHistoryPage(query.page);
  const retryHref =
    page > 1
      ? `/workspace/purchases?page=${encodeURIComponent(String(page))}`
      : "/workspace/purchases";
  const result = await orderRepository.pageBuyerHistory(user.id, page).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClip}>
        <HistoryShell copy={copy} area="purchases" notice={historyNotice}>
          <ErrorState
            title={copy.purchasesLoadUnavailable}
            description={copy.purchasesLoadUnavailableHint}
            action={
              <Link href={retryHref} className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </HistoryShell>
      </div>
    );
  }

  return (
    <div className={pageShellClip}>
      <HistoryShell copy={copy} area="purchases" notice={historyNotice}>
        <Link href="/subscriptions" className={linkAccentSmRounded}>
          {getCommercialCopy(typedLocale).catalog}
        </Link>
        <Link href="/workspace/order-cases" className={linkAccentSmRounded}>
          {orderCaseCopy(typedLocale).buyerCases}
        </Link>
        {result.orders.length === 0 ? (
          <EmptyState
            title={copy.emptyPurchases}
            description={copy.emptyPurchasesHint}
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {result.orders.map((order) => (
              <li key={order.id} className={panelMinSpace3P5}>
                <div className={typeFlexMinWrapStartBetweenGap3}>
                  <h2 className={typeMinBreakBaseSemiboldPrimary}>
                    {copy.orderNumber}: {order.orderNumber}
                  </h2>
                  <span className={typeRoundedBorderPx2Py1XsSecondary}>
                    {orderStatusLabel(order.status, copy.orderStatuses)}
                  </span>
                </div>
                <dl className={typeGridMinGap3Sm2}>
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
                    <dd className={typeNumericSemiboldPrimary}>
                      {formatHistoryAmount(order.totalAmount, order.currency, typedLocale)}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/workspace/purchases/${encodeURIComponent(order.id)}`}
                  className={linkAccentSmRounded}
                >
                  {copy.details}
                </Link>
              </li>
            ))}
          </ol>
        )}
        <HistoryPagination
          copy={copy}
          area="purchases"
          page={result.page}
          totalPages={result.totalPages}
        />
      </HistoryShell>
    </div>
  );
}
