import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialPlanForm } from "../../../../../components/commercial-plan-form";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create commercial plan | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function NewCommercialPlan() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const user = await authService.getSession(store.get("nexus_session")?.value),
    copy = getCommercialCopy(locale);
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
