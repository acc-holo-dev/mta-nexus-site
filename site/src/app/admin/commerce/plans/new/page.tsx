import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { CommercialPlanForm } from "../../../../../features/commerce/commercial-plans";
import { PlatformSignIn } from "../../../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../../../features/shell/session-error";
import { getDictionary } from "../../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";
import { authService } from "../../../../../lib/services/accounts/auth-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create commercial plan | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function NewCommercialPlan() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getCommercialCopy(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/commerce/plans/new"}
      />
    );
  }
  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/commerce/plans/new" />;
  if (user.role !== "admin") notFound();
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link
        href="/admin/commerce/plans"
        className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.newPlan}</h1>
      <CommercialPlanForm key={user.id} actorId={user.id} />
    </div>
  );
}
