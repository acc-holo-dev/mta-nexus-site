import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { ResourceCartControls } from "../../../components/resource-cart-controls";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getResourceCommerceCopy } from "../../../lib/resource-commerce-i18n";
import { authService } from "../../../lib/services/auth-service";
import { commerceService } from "../../../lib/services/commerce-service";

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
  const actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
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
          id="workspace-cart-unavailable"
          title={copy.loadUnavailable}
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
