import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../lib/services/commerce/commerce-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { ResourceCartControls } from "../../resources/cart-controls";
import {
  getResourceCommerceCopy,
  resourceCartHonestyCopy,
} from "../../resources/resource-commerce-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary, typeSmSecondary, typeSpace2BorderBPb5 } from "../../shell/type-shell";
export async function cartWorkspaceMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceCommerceCopy(await getRequestLocale()).cart} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function CartWorkspaceScreen() {
  const [locale, cookieStore] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getResourceCommerceCopy(locale);
  const walletEnabled = isWalletEngineEnabled();
  const honesty = resourceCartHonestyCopy(locale, walletEnabled);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.cart}
        message={copy.loadUnavailable}
        retryHref="/workspace/cart"
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/cart" />;
  const cart = await commerceService.getResourceCart(actor).catch(() => null);
  if (!cart) {
    return (
      <div className={pageShellMax4xl}>
        <header className={typeSpace2BorderBPb5}>
          <h1 className={typeDisplayPrimary}>{copy.cart}</h1>
          <p className={typeSmSecondary}>{honesty.subtitle}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href="/workspace/cart" className={linkAccentSmRounded}>
              {getDictionary(locale).errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellMax4xl}>
      <header className={typeSpace2BorderBPb5}>
        <h1 className={typeDisplayPrimary}>{copy.cart}</h1>
        <p className={typeSmSecondary}>{honesty.subtitle}</p>
      </header>
      <ResourceCartControls key={actor.id} initialCart={cart} walletEnabled={walletEnabled} />
    </div>
  );
}
