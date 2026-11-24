import {
  AppError,
  type ExplicitFxRate,
  type LedgerEntry,
  publicPriceEstimates,
  quoteExplicitFx,
  type TopUpIntent,
  type WithdrawalIntent,
} from "@nexus/domain";
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
  isWalletWithdrawEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax6xl } from "../../shell/page-shell";
import { panelSpace2P4, panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeNumericPrimary,
  typeRoundedBorderP4SmSecondary,
  typeSemiboldPrimary,
  typeSpace2Sm,
  typeXlPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatHistoryDate } from "../commerce-history-format";
import { formatFinancialMinor } from "../financial-i18n";
import { WalletHoldReleaseForm } from "../wallet-hold-release";
import { getWalletCopy } from "../wallet-i18n";
import { WalletTopUpCancelForm, WalletTopUpForm, WalletTopUpStubCreditForm } from "../wallet-topup";
import {
  WalletWithdrawCancelForm,
  WalletWithdrawForm,
  WalletWithdrawStubSettleForm,
} from "../wallet-withdraw";

const walletPaymentService = new WalletPaymentService();
const CURRENCIES = ["USD", "EUR", "RUB"] as const;

function FxEstimate({
  copy,
  locale,
  rate,
  sourceAmount,
  sourceCurrency,
}: {
  copy: ReturnType<typeof getWalletCopy>;
  locale: Parameters<typeof formatFinancialMinor>[2];
  rate: ExplicitFxRate;
  sourceAmount: number;
  sourceCurrency: string;
}) {
  let destination: number;
  try {
    destination = quoteExplicitFx({
      sourceAmount,
      baseAmount: rate.baseAmount,
      quoteAmount: rate.quoteAmount,
    });
  } catch (error) {
    const code = error instanceof AppError ? error.code : "";
    return <p className={typeXsMuted}>{code === "FX_EXCEEDS" ? copy.fxExceeds : copy.fxDust}</p>;
  }
  return (
    <p className={typeNumericPrimary}>
      {copy.fxRate
        .replace("{base}", formatFinancialMinor(rate.baseAmount, sourceCurrency, locale))
        .replace("{quote}", formatFinancialMinor(rate.quoteAmount, rate.quoteCurrency, locale))}
      {" · "}
      {copy.fxEstimate.replace(
        "{destination}",
        formatFinancialMinor(destination, rate.quoteCurrency, locale),
      )}
    </p>
  );
}

function ActivityEstimate({
  amount,
  copy,
  currency,
  locale,
  rates,
}: {
  amount: number;
  copy: ReturnType<typeof getWalletCopy>;
  currency: string;
  locale: Parameters<typeof formatFinancialMinor>[2];
  rates: readonly ExplicitFxRate[] | null | undefined;
}) {
  const lines = publicPriceEstimates({ price: amount, currency }, rates);
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

function maturedHoldCount(
  holds: Array<{ currency: string; releaseAt: string }> | null | undefined,
  currency: string,
  nowMs: number,
): number {
  if (!holds) return 0;
  return holds.filter((hold) => hold.currency === currency && Date.parse(hold.releaseAt) <= nowMs)
    .length;
}

function statusLabel(
  copy: ReturnType<typeof getWalletCopy>,
  status: TopUpIntent["status"],
): string {
  if (status === "awaiting_provider") return copy.statusAwaiting;
  if (status === "succeeded") return copy.statusSucceeded;
  if (status === "failed") return copy.statusFailed;
  if (status === "cancelled") return copy.statusCancelled;
  return copy.statusCreated;
}

function activityKindLabel(
  copy: ReturnType<typeof getWalletCopy>,
  referenceType: LedgerEntry["referenceType"],
): string {
  if (referenceType === "topup") return copy.activityTopUp;
  if (referenceType === "wallet_spend") return copy.activitySpend;
  if (referenceType === "wallet_hold") return copy.activityHold;
  if (referenceType === "withdrawal") return copy.activityWithdrawal;
  if (referenceType === "refund") return copy.activityRefund;
  if (referenceType === "staff_grant") return copy.activityStaffGrant;
  return copy.activityOther;
}

function withdrawalStatusLabel(
  copy: ReturnType<typeof getWalletCopy>,
  status: WithdrawalIntent["status"],
): string {
  if (status === "awaiting_provider") return copy.statusAwaiting;
  if (status === "succeeded") return copy.statusSucceeded;
  if (status === "failed") return copy.statusFailed;
  if (status === "cancelled") return copy.statusCancelled;
  return copy.statusCreated;
}

export async function walletWorkspaceMetadata(): Promise<Metadata> {
  return {
    title: `${getWalletCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function WalletWorkspaceScreen({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string | string[] }>;
}) {
  if (!isWalletEngineEnabled()) notFound();

  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getWalletCopy(locale);
  const dictionary = getDictionary(locale);
  const requested = CURRENCIES.find((value) => value === query.currency);
  const signInPath = `/workspace/wallet?currency=${requested ?? "EUR"}`;

  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.loadUnavailable}
        retryHref={signInPath}
      />
    );
  }
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath={signInPath} />;
  }

  const accountId = `user:${user.id}`;
  let balances: Array<{
    currency: (typeof CURRENCIES)[number];
    available: number | null;
    held: number | null;
  }>;
  try {
    balances = await Promise.all(
      CURRENCIES.map(async (value) => {
        const read = async (load: Promise<number>) => {
          try {
            return await load;
          } catch (error) {
            if (error instanceof AppError && [403, 404].includes(error.statusCode)) throw error;
            return null;
          }
        };
        return {
          currency: value,
          available: await read(walletPaymentService.getAvailableBalance(accountId, value)),
          held: await read(walletPaymentService.getHeldBalance(accountId, value)),
        };
      }),
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    throw error;
  }
  const currency =
    requested ??
    balances.find((row) => (row.available ?? 0) > 0)?.currency ??
    balances.find((row) => row.available !== null)?.currency ??
    "EUR";
  const selected = balances.find((row) => row.currency === currency);
  const available = selected?.available ?? null;
  const returnPath = `/workspace/wallet?currency=${currency}`;
  const history =
    available === null
      ? null
      : await walletPaymentService.listRecentTopUps(accountId, 20).catch(() => null);
  const fxRates =
    available === null ? null : await walletPaymentService.listFxRates().catch(() => null);
  const activity =
    available === null
      ? null
      : await walletPaymentService.listRecentActivity(accountId, currency, 20).catch(() => null);
  const heldBalance = available === null ? null : (selected?.held ?? null);
  const heldList =
    heldBalance === null
      ? null
      : await walletPaymentService.listHeld(accountId, 20).catch(() => null);
  const orgSellerAccounts =
    available === null
      ? []
      : await walletPaymentService.listManageableOrganizationSellerAccounts(user).catch(() => []);
  const withdrawEnabled = isWalletWithdrawEnabled();
  const orgWalletSummaries = await Promise.all(
    orgSellerAccounts.map(async (org) => {
      const [orgAvailable, held, holds, orgTopUps, orgActivity, orgWithdrawals] = await Promise.all(
        [
          walletPaymentService.getAvailableBalance(org.accountId, currency).catch(() => null),
          walletPaymentService.getHeldBalance(org.accountId, currency).catch(() => null),
          walletPaymentService.listHeld(org.accountId, 20).catch(() => null),
          walletPaymentService.listRecentTopUps(org.accountId, 20).catch(() => null),
          walletPaymentService.listRecentActivity(org.accountId, currency, 20).catch(() => null),
          withdrawEnabled
            ? walletPaymentService.listRecentWithdrawals(org.accountId, 20).catch(() => null)
            : Promise.resolve(null),
        ],
      );
      return {
        ...org,
        available: orgAvailable,
        held,
        holds,
        topUps: orgTopUps,
        activity: orgActivity,
        withdrawals: orgWithdrawals,
      };
    }),
  );
  const withdrawals =
    available === null || !withdrawEnabled
      ? null
      : await walletPaymentService.listRecentWithdrawals(accountId, 20).catch(() => null);

  if (available === null) {
    return (
      <div className={pageShellMax6xl}>
        <Link href="/workspace/finance" className={linkAccentSmRounded}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const pending = (history ?? []).filter((intent) => intent.status === "awaiting_provider");
  const recent = (history ?? []).filter((intent) => intent.currency === currency);
  const recentWithdrawals = (withdrawals ?? []).filter((intent) => intent.currency === currency);
  const nowMs = Date.now();
  const personalMatured = maturedHoldCount(heldList, currency, nowMs);

  return (
    <div className={pageShellMax6xl}>
      <Link href="/workspace/finance" className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.title}</h1>
      <h2 className={typeXlPrimary}>{copy.available}</h2>
      <p role="note" className={typeRoundedBorderP4SmSecondary}>
        {copy.note}
      </p>
      <p role="note" className={typeXsMuted}>
        {withdrawEnabled ? copy.withdrawEnabledNote : copy.withdrawNote}
      </p>
      <nav aria-label={copy.balances} className="grid gap-4 md:grid-cols-3">
        {balances.map((row) => (
          <Link
            key={row.currency}
            href={`/workspace/wallet?currency=${row.currency}`}
            aria-current={row.currency === currency ? "page" : undefined}
            className={`${panelSpace2P4} block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]`}
          >
            <span className={typeSemiboldPrimary}>{row.currency}</span>
            <span className={typeNumericPrimary}>
              {row.available === null
                ? copy.balanceUnavailable
                : formatFinancialMinor(row.available, row.currency, locale)}
            </span>
            <span className={typeXsMuted}>
              {copy.held}:{" "}
              {row.held === null
                ? copy.balanceUnavailable
                : formatFinancialMinor(row.held, row.currency, locale)}
            </span>
          </Link>
        ))}
      </nav>
      <section className={panelSpace3P5} aria-labelledby="wallet-fx-heading">
        <h3 id="wallet-fx-heading" className={typeSemiboldPrimary}>
          {copy.fxTitle}
        </h3>
        <p role="note" className={typeXsMuted}>
          {copy.fxNote}
        </p>
        {fxRates === null ? (
          <p className={typeXsMuted}>{copy.fxUnavailable}</p>
        ) : (
          <ul className={typeSpace2Sm}>
            {CURRENCIES.filter((value) => value !== currency).map((quoteCurrency) => {
              const rate = fxRates.find(
                (item) => item.baseCurrency === currency && item.quoteCurrency === quoteCurrency,
              );
              return (
                <li key={quoteCurrency}>
                  {rate ? (
                    <FxEstimate
                      copy={copy}
                      locale={locale}
                      rate={rate}
                      sourceAmount={available ?? 0}
                      sourceCurrency={currency}
                    />
                  ) : (
                    <p className={typeXsMuted}>
                      {quoteCurrency}: {copy.fxNone}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className={panelSpace3P5} aria-labelledby="wallet-available-heading">
        <h3 id="wallet-available-heading" className={typeSemiboldPrimary}>
          {currency}
        </h3>
        <dl className={typeSpace2Sm}>
          <div>
            <dt className="text-muted">{copy.available}</dt>
            <dd className={typeNumericPrimary}>
              {formatFinancialMinor(available, currency, locale)}
            </dd>
          </div>
        </dl>
      </section>
      {pending.length > 0 ? (
        <section className={panelSpace3P5} aria-labelledby="wallet-pending-heading">
          <h3 id="wallet-pending-heading" className={typeSemiboldPrimary}>
            {copy.pending}
          </h3>
          <ul className={typeSpace2Sm}>
            {pending.map((intent) => (
              <li key={intent.id}>
                <p className={typeNumericPrimary}>
                  {formatFinancialMinor(intent.amount, intent.currency, locale)}
                </p>
                <ActivityEstimate
                  amount={intent.amount}
                  copy={copy}
                  currency={intent.currency}
                  locale={locale}
                  rates={available === null ? undefined : fxRates}
                />
                <p className={typeXsMuted}>
                  {statusLabel(copy, intent.status)} · {intent.id}
                </p>
                {intent.status === "awaiting_provider" || intent.status === "created" ? (
                  <>
                    <WalletTopUpCancelForm actorId={user.id} intentId={intent.id} />
                    {intent.providerId === "stub" ? (
                      <WalletTopUpStubCreditForm actorId={user.id} intentId={intent.id} />
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <WalletTopUpForm actorId={user.id} currency={currency} />
      <section className={panelSpace3P5} aria-labelledby="wallet-held-heading">
        <h3 id="wallet-held-heading" className={typeSemiboldPrimary}>
          {copy.held}
        </h3>
        <p role="note" className={typeXsMuted}>
          {copy.heldNote}
        </p>
        {heldBalance === null || heldList === null ? (
          <p className={typeXsMuted}>{copy.heldUnavailable}</p>
        ) : (
          <>
            <dl className={typeSpace2Sm}>
              <div>
                <dt className="text-muted">{copy.held}</dt>
                <dd className={typeNumericPrimary}>
                  {formatFinancialMinor(heldBalance, currency, locale)}
                </dd>
              </div>
            </dl>
            {heldList.filter((hold) => hold.currency === currency).length === 0 ? (
              <EmptyState title={copy.heldEmpty} description={copy.heldEmptyHint} />
            ) : (
              <ul className={typeSpace2Sm}>
                {heldList
                  .filter((hold) => hold.currency === currency)
                  .map((hold) => (
                    <li key={hold.id}>
                      <p className={typeNumericPrimary}>
                        {formatFinancialMinor(hold.amount, hold.currency, locale)}
                      </p>
                      <ActivityEstimate
                        amount={hold.amount}
                        copy={copy}
                        currency={hold.currency}
                        locale={locale}
                        rates={available === null ? undefined : fxRates}
                      />
                      <p className={typeXsMuted}>
                        {copy.heldReleaseAt}: {formatHistoryDate(new Date(hold.releaseAt), locale)}{" "}
                        · {hold.orderId}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
            <WalletHoldReleaseForm actorId={user.id} maturedCount={personalMatured} />
          </>
        )}
      </section>
      {orgWalletSummaries.length > 0 ? (
        <section className={panelSpace3P5} aria-labelledby="wallet-org-held-heading">
          <h3 id="wallet-org-held-heading" className={typeSemiboldPrimary}>
            {copy.heldOrg}
          </h3>
          <p role="note" className={typeXsMuted}>
            {copy.heldOrgNote}
          </p>
          <ul className={typeSpace2Sm}>
            {orgWalletSummaries.map((org) => {
              const holds =
                org.holds?.filter((hold) => hold.currency === currency) ??
                ([] as NonNullable<typeof org.holds>);
              const orgMatured = maturedHoldCount(org.holds, currency, nowMs);
              const orgRecentTopUps =
                org.topUps?.filter((intent) => intent.currency === currency) ?? [];
              const orgRecentWithdrawals =
                org.withdrawals?.filter((intent) => intent.currency === currency) ?? [];
              return (
                <li key={org.organizationId}>
                  <p className={typeSemiboldPrimary}>{org.accountId}</p>
                  {org.available === null ? (
                    <p className={typeXsMuted}>{copy.loadUnavailable}</p>
                  ) : (
                    <dl className={typeSpace2Sm}>
                      <div>
                        <dt className="text-muted">{copy.orgAvailable}</dt>
                        <dd className={typeNumericPrimary}>
                          {formatFinancialMinor(org.available, currency, locale)}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <h4 className={typeSemiboldPrimary}>{copy.orgTopUps}</h4>
                  <WalletTopUpForm
                    actorId={user.id}
                    currency={currency}
                    organizationId={org.organizationId}
                  />
                  {org.topUps === null ? (
                    <p className={typeXsMuted}>{copy.orgTopUpsUnavailable}</p>
                  ) : orgRecentTopUps.length === 0 ? (
                    <EmptyState title={copy.orgTopUpsEmpty} description={copy.orgTopUpNote} />
                  ) : (
                    <ul className={typeSpace2Sm}>
                      {orgRecentTopUps.map((intent) => (
                        <li key={intent.id}>
                          <p className={typeNumericPrimary}>
                            {formatFinancialMinor(intent.amount, intent.currency, locale)}
                          </p>
                          <ActivityEstimate
                            amount={intent.amount}
                            copy={copy}
                            currency={intent.currency}
                            locale={locale}
                            rates={available === null ? undefined : fxRates}
                          />
                          <p className={typeXsMuted}>
                            {statusLabel(copy, intent.status)} · {copy.recordedAt}:{" "}
                            {formatHistoryDate(new Date(intent.createdAt), locale)} · {intent.id}
                          </p>
                          {intent.status === "awaiting_provider" || intent.status === "created" ? (
                            <>
                              <WalletTopUpCancelForm
                                actorId={user.id}
                                intentId={intent.id}
                                organizationId={org.organizationId}
                              />
                              {intent.providerId === "stub" ? (
                                <WalletTopUpStubCreditForm
                                  actorId={user.id}
                                  intentId={intent.id}
                                  organizationId={org.organizationId}
                                />
                              ) : null}
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {org.held === null || org.holds === null ? (
                    <p className={typeXsMuted}>{copy.heldUnavailable}</p>
                  ) : holds.length === 0 ? (
                    <EmptyState title={copy.heldOrgEmpty} description={copy.heldOrgEmptyHint} />
                  ) : (
                    <>
                      <p className={typeNumericPrimary}>
                        {formatFinancialMinor(org.held, currency, locale)}
                      </p>
                      <ul className={typeSpace2Sm}>
                        {holds.map((hold) => (
                          <li key={hold.id}>
                            <p className={typeNumericPrimary}>
                              {formatFinancialMinor(hold.amount, hold.currency, locale)}
                            </p>
                            <ActivityEstimate
                              amount={hold.amount}
                              copy={copy}
                              currency={hold.currency}
                              locale={locale}
                              rates={available === null ? undefined : fxRates}
                            />
                            <p className={typeXsMuted}>
                              {copy.heldReleaseAt}:{" "}
                              {formatHistoryDate(new Date(hold.releaseAt), locale)} · {hold.orderId}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <WalletHoldReleaseForm
                    actorId={user.id}
                    organizationId={org.organizationId}
                    maturedCount={orgMatured}
                  />
                  <h4 className={typeSemiboldPrimary}>{copy.orgActivity}</h4>
                  {org.activity === null ? (
                    <p className={typeXsMuted}>{copy.orgActivityUnavailable}</p>
                  ) : org.activity.length === 0 ? (
                    <EmptyState
                      title={copy.orgActivityEmpty}
                      description={copy.activityEmptyHint}
                    />
                  ) : (
                    <ul className={typeSpace2Sm}>
                      {org.activity.map((entry) => (
                        <li key={entry.id}>
                          <p className={typeNumericPrimary}>
                            {entry.amount < 0 ? "−" : "+"}
                            {formatFinancialMinor(Math.abs(entry.amount), entry.currency, locale)}
                          </p>
                          <ActivityEstimate
                            amount={Math.abs(entry.amount)}
                            copy={copy}
                            currency={entry.currency}
                            locale={locale}
                            rates={available === null ? undefined : fxRates}
                          />
                          <p className={typeXsMuted}>
                            {entry.amount < 0 ? copy.activityDebit : copy.activityCredit} ·{" "}
                            {activityKindLabel(copy, entry.referenceType)} · {copy.recordedAt}:{" "}
                            {formatHistoryDate(new Date(entry.createdAt), locale)} ·{" "}
                            {entry.referenceId}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {withdrawEnabled ? (
                    <>
                      <h4 className={typeSemiboldPrimary}>{copy.orgWithdrawals}</h4>
                      <WalletWithdrawForm
                        actorId={user.id}
                        currency={currency}
                        organizationId={org.organizationId}
                      />
                      {org.withdrawals === null ? (
                        <p className={typeXsMuted}>{copy.withdrawalsUnavailable}</p>
                      ) : orgRecentWithdrawals.length === 0 ? (
                        <EmptyState
                          title={copy.orgWithdrawalsEmpty}
                          description={copy.withdrawalsNote}
                        />
                      ) : (
                        <ul className={typeSpace2Sm}>
                          {orgRecentWithdrawals.map((intent) => (
                            <li key={intent.id}>
                              <p className={typeNumericPrimary}>
                                {formatFinancialMinor(intent.amount, intent.currency, locale)}
                              </p>
                              <ActivityEstimate
                                amount={intent.amount}
                                copy={copy}
                                currency={intent.currency}
                                locale={locale}
                                rates={available === null ? undefined : fxRates}
                              />
                              <p className={typeXsMuted}>
                                {withdrawalStatusLabel(copy, intent.status)} · {copy.recordedAt}:{" "}
                                {formatHistoryDate(new Date(intent.createdAt), locale)} ·{" "}
                                {intent.id}
                              </p>
                              {intent.status === "awaiting_provider" ? (
                                <>
                                  <WalletWithdrawCancelForm
                                    actorId={user.id}
                                    intentId={intent.id}
                                    organizationId={org.organizationId}
                                  />
                                  {intent.providerId === "stub" ? (
                                    <WalletWithdrawStubSettleForm
                                      actorId={user.id}
                                      intentId={intent.id}
                                      organizationId={org.organizationId}
                                    />
                                  ) : null}
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {withdrawEnabled ? (
        <section className={panelSpace3P5} aria-labelledby="wallet-withdrawals-heading">
          <h3 id="wallet-withdrawals-heading" className={typeSemiboldPrimary}>
            {copy.withdrawals}
          </h3>
          <p role="note" className={typeXsMuted}>
            {copy.withdrawalsNote}
          </p>
          <WalletWithdrawForm actorId={user.id} currency={currency} />
          {withdrawals === null ? (
            <p className={typeXsMuted}>{copy.withdrawalsUnavailable}</p>
          ) : recentWithdrawals.length === 0 ? (
            <EmptyState title={copy.withdrawalsEmpty} description={copy.withdrawalsNote} />
          ) : (
            <ul className={typeSpace2Sm}>
              {recentWithdrawals.map((intent) => (
                <li key={intent.id}>
                  <p className={typeNumericPrimary}>
                    {formatFinancialMinor(intent.amount, intent.currency, locale)}
                  </p>
                  <ActivityEstimate
                    amount={intent.amount}
                    copy={copy}
                    currency={intent.currency}
                    locale={locale}
                    rates={available === null ? undefined : fxRates}
                  />
                  <p className={typeXsMuted}>
                    {withdrawalStatusLabel(copy, intent.status)} · {copy.recordedAt}:{" "}
                    {formatHistoryDate(new Date(intent.createdAt), locale)} · {intent.id}
                  </p>
                  {intent.status === "awaiting_provider" ? (
                    <>
                      <WalletWithdrawCancelForm actorId={user.id} intentId={intent.id} />
                      {intent.providerId === "stub" ? (
                        <WalletWithdrawStubSettleForm actorId={user.id} intentId={intent.id} />
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <section className={panelSpace3P5} aria-labelledby="wallet-activity-heading">
        <h3 id="wallet-activity-heading" className={typeSemiboldPrimary}>
          {copy.activity}
        </h3>
        {activity === null ? (
          <p className={typeXsMuted}>{copy.activityUnavailable}</p>
        ) : activity.length === 0 ? (
          <EmptyState title={copy.activityEmpty} description={copy.activityEmptyHint} />
        ) : (
          <ul className={typeSpace2Sm}>
            {activity.map((entry) => (
              <li key={entry.id}>
                <p className={typeNumericPrimary}>
                  {entry.amount < 0 ? "−" : "+"}
                  {formatFinancialMinor(Math.abs(entry.amount), entry.currency, locale)}
                </p>
                <ActivityEstimate
                  amount={Math.abs(entry.amount)}
                  copy={copy}
                  currency={entry.currency}
                  locale={locale}
                  rates={fxRates}
                />
                <p className={typeXsMuted}>
                  {entry.amount < 0 ? copy.activityDebit : copy.activityCredit} ·{" "}
                  {activityKindLabel(copy, entry.referenceType)} · {copy.recordedAt}:{" "}
                  {formatHistoryDate(new Date(entry.createdAt), locale)} · {entry.referenceId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={panelSpace3P5} aria-labelledby="wallet-history-heading">
        <h3 id="wallet-history-heading" className={typeSemiboldPrimary}>
          {copy.history}
        </h3>
        {history === null ? (
          <p className={typeXsMuted}>{copy.historyUnavailable}</p>
        ) : recent.length === 0 ? (
          <EmptyState title={copy.historyEmpty} description={copy.historyEmptyHint} />
        ) : (
          <ul className={typeSpace2Sm}>
            {recent.map((intent) => (
              <li key={intent.id}>
                <p className={typeNumericPrimary}>
                  {formatFinancialMinor(intent.amount, intent.currency, locale)}
                </p>
                <ActivityEstimate
                  amount={intent.amount}
                  copy={copy}
                  currency={intent.currency}
                  locale={locale}
                  rates={available === null ? undefined : fxRates}
                />
                <p className={typeXsMuted}>
                  {statusLabel(copy, intent.status)} · {copy.recordedAt}:{" "}
                  {formatHistoryDate(new Date(intent.createdAt), locale)} · {intent.id}
                </p>
                {intent.status === "awaiting_provider" || intent.status === "created" ? (
                  <>
                    <WalletTopUpCancelForm actorId={user.id} intentId={intent.id} />
                    {intent.providerId === "stub" ? (
                      <WalletTopUpStubCreditForm actorId={user.id} intentId={intent.id} />
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
