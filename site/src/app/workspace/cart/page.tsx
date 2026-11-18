import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ResourceCartControls } from "../../../features/resources/cart-controls";
import { getResourceCommerceCopy } from "../../../features/resources/resource-commerce-i18n";
import { PlatformSignIn } from "../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../features/shell/session-error";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../lib/services/commerce/commerce-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource cart | MTA NEXUS",
  robots: { index: false, follow: false },
};

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const retryLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function ResourceCartPage() {
  const [locale, cookieStore] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getResourceCommerceCopy(locale);
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
      <div className={pageShellClass}>
        <header className="space-y-2 border-b border-base pb-5">
          <h1 className="font-display text-primary">{copy.cart}</h1>
          <p className="text-sm text-secondary">{copy.subtitle}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href="/workspace/cart" className={retryLinkClass}>
              {getDictionary(locale).errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <header className="space-y-2 border-b border-base pb-5">
        <h1 className="font-display text-primary">{copy.cart}</h1>
        <p className="text-sm text-secondary">{copy.subtitle}</p>
      </header>
      <ResourceCartControls key={actor.id} initialCart={cart} />
    </div>
  );
}
