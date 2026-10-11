import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTermsReportView } from "../../../../../../components/order-terms-report";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { orderTermsCopy } from "../../../../../../lib/order-terms-i18n";
import { orderTermsPageQuery } from "../../../../../../lib/order-terms-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { orderTermsService } from "../../../../../../lib/services/order-terms-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Order terms | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function TermsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, { id }, query] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = orderTermsCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (actor?.role !== "admin") notFound();
  try {
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) throw new AppError("Invalid query", 400, "ORDER_TERMS_INVALID");
      if (value !== undefined) values.set(key, value);
    }
    const report = await orderTermsService.report(actor, id, "admin", orderTermsPageQuery(values));
    return <OrderTermsReportView report={report} scope="admin" locale={locale} />;
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/admin/commerce/reconciliation" className="text-accent underline">
            {c.back}
          </Link>
        </section>
      );
    throw error;
  }
}
