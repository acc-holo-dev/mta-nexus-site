import { financialStatementsRepository } from "@nexus/db";
import { AppError, publicPriceEstimates } from "@nexus/domain";
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
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax6xl } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBorderT,
  typeBreakP3,
  typeDisplayPrimary,
  typeFlexGap4Sm,
  typeFlexWrapGap4,
  typeFlexWrapGap4Sm,
  typeLgSemibold,
  typeNumericPrimary,
  typeP3Numeric,
  typeRoundedBorderP4SmSecondary,
  typeSemiboldPrimary,
  typeSpace2Sm,
  typeSpace3BorderTPt5,
  typeWFullLeftSm,
  typeXlPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatHistoryDate, parseHistoryPage } from "../commerce-history-format";
import { financialReferenceLabel, formatFinancialMinor, getFinancialCopy } from "../financial-i18n";
import { getWalletCopy } from "../wallet-i18n";

function StatementEstimate({
  amount,
  currency,
  locale,
  rates,
  copy,
}: {
  amount: number | string;
  currency: string;
  locale: Parameters<typeof formatFinancialMinor>[2];
  rates: Parameters<typeof publicPriceEstimates>[1];
  copy: ReturnType<typeof getWalletCopy> | null;
}) {
  if (!copy) return null;
  const text = String(amount);
  if (!/^-?\d+$/u.test(text)) return null;
  const minor = Number(text);
  if (!Number.isSafeInteger(minor)) return null;
  const lines = publicPriceEstimates({ price: Math.abs(minor), currency }, rates);
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

const walletPaymentService = new WalletPaymentService();
const WALLET_CURRENCIES = ["USD", "EUR", "RUB"] as const;

export async function workspaceFinanceMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function WorkspaceFinanceScreen({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    currency?: string | string[];
    organizationId?: string | string[];
    scopePage?: string | string[];
  }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getFinancialCopy(locale);
  const dictionary = getDictionary(locale);
  const returnQuery = new URLSearchParams();
  for (const key of ["page", "currency", "organizationId", "scopePage"] as const) {
    const value = query[key];
    if (typeof value === "string") returnQuery.set(key, value);
  }
  const returnPath = `/workspace/finance${returnQuery.size ? `?${returnQuery}` : ""}`;
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.statementsLoadUnavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  const currency = ["USD", "EUR", "RUB"].find((value) => value === query.currency),
    organizationId =
      typeof query.organizationId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/u.test(query.organizationId)
        ? query.organizationId
        : undefined;
  if (query.organizationId && !organizationId) notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const scopePageNumber = Math.min(parseHistoryPage(query.scopePage), 1000);
  const returnHref = (() => {
    const params = new URLSearchParams({
      page: String(pageNumber),
      scopePage: String(scopePageNumber),
      ...(currency ? { currency } : {}),
      ...(organizationId ? { organizationId } : {}),
    });
    return `/workspace/finance?${params}`;
  })();
  const [result, scopes] = await Promise.all([
    financialStatementsRepository
      .statement(user.id, pageNumber, currency, organizationId)
      .catch((error) => {
        if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
        return null;
      }),
    financialStatementsRepository.scopes(user.id, scopePageNumber).catch(() => null),
  ]);
  if (!result || !scopes) {
    return (
      <div className={pageShellMax6xl}>
        <Link href="/workspace/sales" className={linkAccentSmRounded}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.statementsLoadUnavailable}
          description={copy.statementsLoadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (
    page: number,
    selectedCurrency: string | null = currency ?? null,
    selectedScope = organizationId,
    scopePage = scopes.page,
  ) =>
    `/workspace/finance?${new URLSearchParams({ page: String(page), scopePage: String(scopePage), ...(selectedCurrency ? { currency: selectedCurrency } : {}), ...(selectedScope ? { organizationId: selectedScope } : {}) })}`;
  const walletEnabled = isWalletEngineEnabled();
  const walletCopy = walletEnabled ? getWalletCopy(locale) : null;
  const walletBalanceByCurrency = new Map<
    string,
    { available: number | null; held: number | null }
  >();
  if (walletEnabled) {
    const currencies = result.totals
      .map((total) => total.currency)
      .filter((value): value is (typeof WALLET_CURRENCIES)[number] =>
        (WALLET_CURRENCIES as readonly string[]).includes(value),
      );
    await Promise.all(
      currencies.map(async (value) => {
        const [available, held] = await Promise.all([
          walletPaymentService.getAvailableBalance(result.scope.id, value).catch(() => null),
          walletPaymentService.getHeldBalance(result.scope.id, value).catch(() => null),
        ]);
        walletBalanceByCurrency.set(value, { available, held });
      }),
    );
  }
  const fxRates = walletEnabled
    ? await walletPaymentService.listFxRates().catch(() => null)
    : undefined;
  return (
    <div className={pageShellMax6xl}>
      <Link href="/workspace/sales" className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.title}</h1>
      <h2 className={typeXlPrimary}>{result.scope.name ?? copy.personal}</h2>
      <p role="note" className={typeRoundedBorderP4SmSecondary}>
        {walletEnabled ? copy.noteWallet : copy.note}
      </p>
      {walletCopy ? (
        <p>
          <Link href="/workspace/wallet" className={linkAccentSmRounded}>
            {walletCopy.walletNav}
          </Link>
        </p>
      ) : null}
      <nav aria-label={copy.currency} className={typeFlexWrapGap4Sm}>
        <Link href={href(1, null)} className={linkAccentSmRounded}>
          {copy.all}
        </Link>
        {["USD", "EUR", "RUB"].map((value) => (
          <Link
            key={value}
            href={href(1, value)}
            aria-current={value === currency ? "page" : undefined}
            className={linkAccentSmRounded}
          >
            {value}
          </Link>
        ))}
      </nav>
      {result.totals.length ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {result.totals.map((total) => {
            const walletBalance = walletBalanceByCurrency.get(total.currency);
            const heldLabel =
              walletEnabled && walletBalance && walletBalance.held !== null
                ? formatFinancialMinor(walletBalance.held, total.currency, locale)
                : walletEnabled
                  ? copy.walletBalanceUnavailable
                  : copy.unknown;
            const availableLabel =
              walletEnabled && walletBalance && walletBalance.available !== null
                ? formatFinancialMinor(walletBalance.available, total.currency, locale)
                : walletEnabled
                  ? copy.walletBalanceUnavailable
                  : copy.unknown;
            const availableEstimates =
              walletCopy && walletBalance && walletBalance.available !== null
                ? publicPriceEstimates(
                    { price: walletBalance.available, currency: total.currency },
                    fxRates,
                  )
                : undefined;
            return (
              <li key={total.currency} className={panelSpace3P5}>
                <h3 className={typeSemiboldPrimary}>{total.currency}</h3>
                <dl className={typeSpace2Sm}>
                  {[
                    [copy.balance, total.balance],
                    [copy.credits, total.credits],
                    [copy.debits, total.debits],
                  ].map(([label, amount]) => (
                    <div key={label}>
                      <dt className="text-muted">{label}</dt>
                      <dd className={typeNumericPrimary}>
                        {formatFinancialMinor(amount, total.currency, locale)}
                      </dd>
                      <StatementEstimate
                        amount={amount}
                        copy={walletCopy}
                        currency={total.currency}
                        locale={locale}
                        rates={fxRates}
                      />
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted">{copy.held}</dt>
                    <dd className={walletEnabled ? typeNumericPrimary : undefined}>{heldLabel}</dd>
                    {walletCopy && walletBalance && walletBalance.held !== null ? (
                      <StatementEstimate
                        amount={walletBalance.held}
                        copy={walletCopy}
                        currency={total.currency}
                        locale={locale}
                        rates={fxRates}
                      />
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-muted">
                      {walletEnabled ? copy.available : copy.availableLegacy}
                    </dt>
                    <dd className={walletEnabled ? typeNumericPrimary : undefined}>
                      {availableLabel}
                    </dd>
                  </div>
                </dl>
                {availableEstimates === null ? (
                  <p className={typeXsMuted}>{walletCopy?.fxUnavailable}</p>
                ) : availableEstimates ? (
                  <ul className={typeXsMuted}>
                    {availableEstimates.map((line) => (
                      <li key={line.quote}>
                        {line.kind === "quote"
                          ? walletCopy?.fxEstimate.replace(
                              "{destination}",
                              formatFinancialMinor(line.amount, line.quote, locale),
                            )
                          : line.kind === "dust"
                            ? walletCopy?.fxDust
                            : line.kind === "invalid"
                              ? walletCopy?.fxExceeds
                              : `${line.quote}: ${walletCopy?.fxNone}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className={typeXsMuted}>
                  {copy.legacy}: {total.legacyEntries}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={walletEnabled ? copy.emptyHintWallet : copy.note}
        />
      )}
      {result.entries.length ? (
        <div className="overflow-x-auto">
          <table className={typeWFullLeftSm}>
            <caption className="sr-only">{copy.title}</caption>
            <thead>
              <tr>
                {[copy.date, copy.reference, copy.currency, copy.balance].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry.id} className={typeBorderT}>
                  <td className="p-3">
                    <time dateTime={entry.createdAt.toISOString()}>
                      {formatHistoryDate(entry.createdAt, locale)}
                    </time>
                    <p className={typeXsMuted}>{entry.journal ? copy.journal : copy.legacy}</p>
                  </td>
                  <td className={typeBreakP3}>
                    {financialReferenceLabel(locale, entry.referenceType)} · {entry.referenceId}
                  </td>
                  <td className={typeP3Numeric}>
                    {formatFinancialMinor(entry.amount, entry.currency, locale)}
                    <StatementEstimate
                      amount={entry.amount}
                      copy={walletCopy}
                      currency={entry.currency}
                      locale={locale}
                      rates={fxRates}
                    />
                  </td>
                  <td className={typeP3Numeric}>
                    {formatFinancialMinor(entry.balanceAfter, entry.currency, locale)}
                    <StatementEstimate
                      amount={entry.balanceAfter}
                      copy={walletCopy}
                      currency={entry.currency}
                      locale={locale}
                      rates={fxRates}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexGap4Sm}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      <section className={typeSpace3BorderTPt5}>
        <h2 className={typeLgSemibold}>{copy.organizations}</h2>
        <Link href="/workspace/finance" className={linkAccentSmRounded}>
          {copy.personal}
        </Link>
        <ul className={typeFlexWrapGap4}>
          {scopes.scopes.map((scope) => (
            <li key={scope.id}>
              <Link href={href(1, currency, scope.id)} className={linkAccentSmRounded}>
                {scope.name}
              </Link>
            </li>
          ))}
        </ul>
        {scopes.totalPages > 1 ? (
          <nav aria-label={copy.organizations} className={typeFlexGap4Sm}>
            {scopes.page > 1 ? (
              <Link
                href={href(result.page, currency, organizationId, scopes.page - 1)}
                className={linkAccentSmRounded}
              >
                {copy.previous}
              </Link>
            ) : null}
            <span>
              {copy.page} {scopes.page} {copy.of} {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link
                href={href(result.page, currency, organizationId, scopes.page + 1)}
                className={linkAccentSmRounded}
              >
                {copy.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
