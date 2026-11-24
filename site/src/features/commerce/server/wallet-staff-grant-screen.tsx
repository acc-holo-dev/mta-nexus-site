import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeRoundedBorderP4SmSecondary,
  typeSmMuted,
} from "../../shell/type-shell";
import { WalletStaffGrantForm } from "../components/wallet-staff-grant-form";
import { getWalletCopy } from "../wallet-i18n";

export async function walletStaffGrantMetadata(): Promise<Metadata> {
  return {
    title: `${getWalletCopy(await getRequestLocale()).grantTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function WalletStaffGrantScreen() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getWalletCopy(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.grantTitle}
        message={copy.loadUnavailable}
        retryHref="/admin/commerce/wallet-grants"
      />
    );
  }
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath="/admin/commerce/wallet-grants" />;
  }
  if (user.role !== "admin") notFound();

  return (
    <div className={pageShellMax5xl}>
      <Link href="/admin/commerce/wallet-providers" className={linkAccentSmRounded}>
        {copy.grantBack}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.grantTitle}</h1>
      <p role="note" className={typeRoundedBorderP4SmSecondary}>
        {copy.grantPageNote}
      </p>
      {isWalletEngineEnabled() ? (
        <WalletStaffGrantForm actorId={user.id} />
      ) : (
        <p className={`${panelSpace3P5} ${typeSmMuted}`}>{copy.grantEngineOff}</p>
      )}
    </div>
  );
}
