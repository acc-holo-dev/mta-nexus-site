import { financialReviewRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeLgSemibold,
  typeSmSecondary,
  typeSpace2Sm,
  typeSpace2SmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatHistoryDate, parseHistoryPage } from "../commerce-history-format";
import { financialReviewListHref } from "../financial-query";
import {
  financialFlags,
  financialOrderLabel,
  financialPaymentLabel,
  financialProviderLabel,
  financialReviewNote,
  formatFinancialMinor,
  getFinancialCopy,
} from "../financial-i18n";
import { orderTermsCopy } from "../order-terms-i18n";
import { ReviewAmountEstimate } from "./financial-reconciliation-screen";

export async function financialReconciliationDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).evidenceDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function FinancialReconciliationDetailScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getFinancialCopy(locale);
  const dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/commerce/reconciliation/"}
      />
    );
  }

  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/admin/commerce/reconciliation/${encodeURIComponent(id)}`}
      />
    );
  if (user.role !== "admin") notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const listFilter = query.filter === "all" ? "all" : "review";
  const listHref = financialReviewListHref("/admin/commerce/reconciliation", {
    filter: listFilter,
    page: 1,
  });
  const detailParams = new URLSearchParams();
  if (pageNumber > 1) detailParams.set("page", String(pageNumber));
  if (listFilter !== "review") detailParams.set("filter", listFilter);
  const returnHref = detailParams.size
    ? `/admin/commerce/reconciliation/${encodeURIComponent(id)}?${detailParams}`
    : `/admin/commerce/reconciliation/${encodeURIComponent(id)}`;
  let missing = false;
  const result = await financialReviewRepository.detail(user.id, id, pageNumber).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  const walletEnabled = isWalletEngineEnabled();

  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link href={listHref} className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const fxRates = walletEnabled
    ? await new WalletPaymentService().listFxRates().catch(() => null)
    : undefined;

  return (
    <div className={pageShellMax4xl}>
      <Link href={listHref} className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeBreakDisplayPrimary}>{result.order.orderNumber}</h1>
      <Link
        href={`/admin/commerce/reconciliation/${encodeURIComponent(id)}/terms`}
        className={linkAccentSm}
      >
        {orderTermsCopy(locale).title}
      </Link>
      <p role="note" className={typeSmSecondary}>
        {financialReviewNote(locale, walletEnabled)}
      </p>
      {walletEnabled ? (
        <nav className={typeFlexWrapGap4Sm} aria-label={copy.walletProvidersLink}>
          <Link href="/admin/commerce/order-cases" className={linkAccentSm}>
            {copy.orderCasesLink}
          </Link>
          <Link href="/admin/commerce/wallet-providers" className={linkAccentSm}>
            {copy.walletProvidersLink}
          </Link>
        </nav>
      ) : null}
      <p>
        {financialOrderLabel(locale, result.order.status)} ·{" "}
        {formatFinancialMinor(result.order.amount, result.order.currency, locale)}
      </p>
      {fxRates !== undefined ? (
        <ReviewAmountEstimate
          amount={result.order.amount}
          currency={result.order.currency}
          locale={locale}
          rates={fxRates}
        />
      ) : null}
      <ul className={typeSpace2SmSecondary}>
        {financialFlags
          .filter((flag) => result.order[flag])
          .map((flag) => (
            <li key={flag}>{copy[flag]}</li>
          ))}
      </ul>
      <h2 className={typeLgSemibold}>{copy.details}</h2>
      {result.attempts.length ? (
        <ol className="space-y-3">
          {result.attempts.map((attempt) => (
            <li key={attempt.id} className={panelMinSpace2P5}>
              <p className="text-sm">
                {financialPaymentLabel(locale, attempt.status)} ·{" "}
                {formatFinancialMinor(attempt.amount, attempt.currency, locale)} · {copy.provider}:{" "}
                {financialProviderLabel(locale, attempt.provider)}
              </p>
              {fxRates !== undefined ? (
                <ReviewAmountEstimate
                  amount={attempt.amount}
                  currency={attempt.currency}
                  locale={locale}
                  rates={fxRates}
                />
              ) : null}
              <time dateTime={attempt.createdAt.toISOString()} className={typeXsMuted}>
                {formatHistoryDate(attempt.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={copy.attemptsEmpty}
          description={walletEnabled ? copy.attemptsEmptyHintWallet : copy.attemptsEmptyHint}
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
          {result.page > 1 ? (
            <Link
              href={(() => {
                const params = new URLSearchParams({ page: String(result.page - 1) });
                if (listFilter !== "review") params.set("filter", listFilter);
                return `?${params}`;
              })()}
              className={linkAccentSm}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={(() => {
                const params = new URLSearchParams({ page: String(result.page + 1) });
                if (listFilter !== "review") params.set("filter", listFilter);
                return `?${params}`;
              })()}
              className={linkAccentSm}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      <h2 className={typeLgSemibold}>{copy.ledger}</h2>
      <ul className={typeSpace2Sm}>
        {result.ledgerTotals.map((total) => (
          <li key={total.currency}>
            {formatFinancialMinor(total.net, total.currency, locale)} · {total.entries}
            {fxRates !== undefined ? (
              <ReviewAmountEstimate
                amount={total.net}
                currency={total.currency}
                locale={locale}
                rates={fxRates}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
