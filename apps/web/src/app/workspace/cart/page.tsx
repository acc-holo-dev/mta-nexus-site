import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ResourceCartControls } from "../../../components/resource-cart-controls";
import { authService } from "../../../lib/services/auth-service";
import { commerceService } from "../../../lib/services/commerce-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getResourceCommerceCopy } from "../../../lib/resource-commerce-i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource cart | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function ResourceCartPage() {
  const [locale, cookieStore] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getResourceCommerceCopy(locale);
  const actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signIn}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.login}
        </Link>
      </section>
    );
  const cart = await commerceService.getResourceCart(actor);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <header className="space-y-2 border-b border-base pb-5">
        <h1 className="font-display text-primary">{copy.cart}</h1>
        <p className="text-sm text-secondary">{copy.subtitle}</p>
      </header>
      <ResourceCartControls key={actor.id} initialCart={cart} />
    </div>
  );
}
