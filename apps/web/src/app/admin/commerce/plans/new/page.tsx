import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CommercialPlanForm } from "../../../../../components/commercial-plan-form";
import { authService } from "../../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create commercial plan | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function NewCommercialPlan() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const user = await authService.getSession(store.get("nexus_session")?.value),
    copy = getCommercialCopy(locale);
  if (user?.role !== "admin") notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/commerce/plans" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.newPlan}</h1>
      <CommercialPlanForm />
    </div>
  );
}
