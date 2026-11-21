import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
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
} from "../../shell/type-shell";
import { formatFinancialMinor } from "../financial-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { WalletTopUpForm } from "../wallet-topup";

const walletPaymentService = new WalletPaymentService();
const CURRENCIES = ["USD", "EUR", "RUB"] as const;

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

  let available: number | null = null;
  try {
    available = await walletPaymentService.getAvailableBalance(`user:${user.id}`, currency);
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    available = null;
  }

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
      <WalletTopUpForm actorId={user.id} currency={currency} />
    </div>
  );
}
