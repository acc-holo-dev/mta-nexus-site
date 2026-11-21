import { AppError, type LedgerEntry, type TopUpIntent } from "@nexus/domain";
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
  typeDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeNumericPrimary,
  typeRoundedBorderP4SmSecondary,
  typeSemiboldPrimary,
  typeSpace2Sm,
  typeXlPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatHistoryDate } from "../commerce-history-format";
import { formatFinancialMinor } from "../financial-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { WalletTopUpForm } from "../wallet-topup";

const walletPaymentService = new WalletPaymentService();
const CURRENCIES = ["USD", "EUR", "RUB"] as const;

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
  return copy.activityOther;
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
  const currency =
    CURRENCIES.find((value) => value === query.currency) ?? ("EUR" as (typeof CURRENCIES)[number]);
  const returnPath = `/workspace/wallet?currency=${currency}`;

  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.loadUnavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }

  const accountId = `user:${user.id}`;
  let available: number | null = null;
  try {
    available = await walletPaymentService.getAvailableBalance(accountId, currency);
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    available = null;
  }
  const history =
    available === null
      ? null
      : await walletPaymentService.listRecentTopUps(accountId, 20).catch(() => null);
  const activity =
    available === null
      ? null
      : await walletPaymentService.listRecentActivity(accountId, currency, 20).catch(() => null);
  const heldBalance =
    available === null
      ? null
      : await walletPaymentService.getHeldBalance(accountId, currency).catch(() => null);
  const heldList =
    heldBalance === null
      ? null
      : await walletPaymentService.listHeld(accountId, 20).catch(() => null);
  const orgSellerAccounts =
    available === null
      ? []
      : await walletPaymentService.listManageableOrganizationSellerAccounts(user).catch(() => []);
  const orgHeldSummaries = await Promise.all(
    orgSellerAccounts.map(async (org) => {
      const [held, holds] = await Promise.all([
        walletPaymentService.getHeldBalance(org.accountId, currency).catch(() => null),
        walletPaymentService.listHeld(org.accountId, 20).catch(() => null),
      ]);
      return { ...org, held, holds };
    }),
  );

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
        {copy.withdrawNote}
      </p>
      <nav aria-label={copy.currency} className={typeFlexWrapGap4Sm}>
        {CURRENCIES.map((value) => (
          <Link
            key={value}
            href={`/workspace/wallet?currency=${value}`}
            aria-current={value === currency ? "page" : undefined}
            className={linkAccentSmRounded}
          >
            {value}
          </Link>
        ))}
      </nav>
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
                <p className={typeXsMuted}>
                  {statusLabel(copy, intent.status)} · {intent.id}
                </p>
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
                      <p className={typeXsMuted}>
                        {copy.heldReleaseAt}: {formatHistoryDate(new Date(hold.releaseAt), locale)}{" "}
                        · {hold.orderId}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </section>
      {orgHeldSummaries.length > 0 ? (
        <section className={panelSpace3P5} aria-labelledby="wallet-org-held-heading">
          <h3 id="wallet-org-held-heading" className={typeSemiboldPrimary}>
            {copy.heldOrg}
          </h3>
          <p role="note" className={typeXsMuted}>
            {copy.heldOrgNote}
          </p>
          <ul className={typeSpace2Sm}>
            {orgHeldSummaries.map((org) => {
              const holds =
                org.holds?.filter((hold) => hold.currency === currency) ??
                ([] as NonNullable<typeof org.holds>);
              return (
                <li key={org.organizationId}>
                  <p className={typeSemiboldPrimary}>{org.accountId}</p>
                  {org.held === null || org.holds === null ? (
                    <p className={typeXsMuted}>{copy.heldUnavailable}</p>
                  ) : holds.length === 0 ? (
                    <p className={typeXsMuted}>{copy.heldOrgEmpty}</p>
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
                            <p className={typeXsMuted}>
                              {copy.heldReleaseAt}:{" "}
                              {formatHistoryDate(new Date(hold.releaseAt), locale)} · {hold.orderId}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
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
                <p className={typeXsMuted}>
                  {statusLabel(copy, intent.status)} · {copy.recordedAt}:{" "}
                  {formatHistoryDate(new Date(intent.createdAt), locale)} · {intent.id}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
