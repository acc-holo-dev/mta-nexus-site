import { orderRepository } from "@nexus/db";
import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellClip } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakPrimary,
  typeMinBreakBaseSemiboldPrimary,
  typeNumericSemiboldPrimary,
  typeSmMuted,
  typeXsMuted,
} from "../../shell/type-shell";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../commerce-history-format";
import { commerceHistoryBetaNotice, getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getFinancialCopy } from "../financial-i18n";
import { sellerSalesCopy } from "../seller-sales-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { HistoryPagination, HistoryShell } from "../workspace-history";

function SaleLineEstimate({
  amount,
  currency,
  locale,
  rates,
  copy,
}: {
  amount: number;
  currency: string;
  locale: "en" | "ru";
  rates: readonly ExplicitFxRate[] | null | undefined;
  copy: ReturnType<typeof getCommerceHistoryCopy>;
}) {
  const lines = publicPriceEstimates({ price: amount, currency }, rates);
  if (lines === undefined) return null;
  if (lines === null) {
    return (
      <p className={typeXsMuted} role="note">
        {copy.saleLineEstimateUnavailable}
      </p>
    );
  }
  return (
    <ul className={typeXsMuted}>
      {lines.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? copy.saleLineEstimate
                .replace("{amount}", formatHistoryAmount(line.amount, line.quote, locale))
                .replace("{base}", formatHistoryAmount(amount, line.base, locale))
            : line.kind === "dust"
              ? copy.saleLineEstimateDust
                  .replace("{base}", line.base)
                  .replace("{quote}", line.quote)
              : line.kind === "invalid"
                ? copy.saleLineEstimateInvalid
                    .replace("{base}", line.base)
                    .replace("{quote}", line.quote)
                : copy.saleLineEstimateNone
                    .replace("{base}", line.base)
                    .replace("{quote}", line.quote)}
        </li>
      ))}
    </ul>
  );
}

export async function salesHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).salesTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SalesHistoryScreen({ query }: { query: { page?: string | string[] } }) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getCommerceHistoryCopy(typedLocale);
  const walletEnabled = isWalletEngineEnabled();
  const historyNotice = commerceHistoryBetaNotice(typedLocale, walletEnabled);
  const walletNavProps = walletEnabled
    ? {
        walletHref: "/workspace/wallet" as const,
        walletLabel: getWalletCopy(typedLocale).walletNav,
      }
    : {};
  const dictionary = getDictionary(typedLocale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={getDictionary(typedLocale).errors.message}
        retryHref={"/workspace/sales"}
      />
    );
  }

  if (!user) {
    const page = typeof query.page === "string" ? query.page : undefined;
    const returnPath =
      page && page !== "1"
        ? `/workspace/sales?page=${encodeURIComponent(page)}`
        : "/workspace/sales";
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }

  const page = parseHistoryPage(query.page);
  const retryHref =
    page > 1 ? `/workspace/sales?page=${encodeURIComponent(String(page))}` : "/workspace/sales";
  const result = await orderRepository.pageSellerHistory(user.id, page).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClip}>
        <HistoryShell copy={copy} area="sales" notice={historyNotice} {...walletNavProps}>
          <ErrorState
            title={copy.salesLoadUnavailable}
            description={copy.salesLoadUnavailableHint}
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

  const fxRates = walletEnabled
    ? await new WalletPaymentService().listFxRates().catch(() => null)
    : undefined;

  return (
    <div className={pageShellClip}>
      <HistoryShell copy={copy} area="sales" notice={historyNotice} {...walletNavProps}>
        <Link href="/workspace/sales/report" className={linkAccentSmRounded}>
          {sellerSalesCopy(typedLocale).title}
        </Link>
        <Link href="/workspace/finance" className={linkAccentSmRounded}>
          {getFinancialCopy(typedLocale).title}
        </Link>
        {walletEnabled ? (
          <Link href="/workspace/wallet" className={linkAccentSmRounded}>
            {getWalletCopy(typedLocale).walletNav}
          </Link>
        ) : null}
        <p role="note" className={typeSmMuted}>
          {walletEnabled ? copy.walletGrossNotice : copy.grossNotice}
        </p>
        {result.sales.length === 0 ? (
          <EmptyState
            title={copy.emptySales}
            description={copy.emptySalesHint}
            icon={<ShoppingBag className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {result.sales.map((sale) => {
              const lineRates = walletEnabled ? fxRates : undefined;
              return (
                <li key={sale.id} className={panelMinSpace3P5}>
                  <h2 className={typeMinBreakBaseSemiboldPrimary}>{sale.productTitle}</h2>
                  <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-muted">{copy.orderNumber}</dt>
                      <dd className={typeBreakPrimary}>{sale.orderNumber}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted">{copy.placed}</dt>
                      <dd className="text-primary">
                        <time dateTime={sale.createdAt.toISOString()}>
                          {formatHistoryDate(sale.createdAt, typedLocale)}
                        </time>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted">{copy.grossPrice}</dt>
                      <dd className={typeNumericSemiboldPrimary}>
                        {formatHistoryAmount(sale.unitPrice, sale.currency, typedLocale)}
                        <SaleLineEstimate
                          amount={sale.unitPrice}
                          currency={sale.currency}
                          locale={typedLocale}
                          rates={lineRates}
                          copy={copy}
                        />
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
        <HistoryPagination
          copy={copy}
          area="sales"
          page={result.page}
          totalPages={result.totalPages}
        />
      </HistoryShell>
    </div>
  );
}

export async function WorkspaceSalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return SalesHistoryScreen({ query: await searchParams });
}
