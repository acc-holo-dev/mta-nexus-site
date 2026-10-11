import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SellerSalesReportView } from "../../../../components/seller-sales-report";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { sellerSalesCopy } from "../../../../lib/seller-sales-i18n";
import { sellerSalesPageQuery } from "../../../../lib/seller-sales-query";
import { authService } from "../../../../lib/services/auth-service";
import { sellerSalesService } from "../../../../lib/services/seller-sales-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sales report | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SellerSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, params] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = sellerSalesCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display">{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  try {
    // Empty form fields are omitted only on the SSR form surface; private APIs stay strict.
    const normalized = { ...params };
    if (normalized.currency === "all") delete normalized.currency;
    if (normalized.productId === "") delete normalized.productId;
    const { query, scopePage } = sellerSalesPageQuery(normalized);
    const [report, scopes] = await Promise.all([
      sellerSalesService.report(actor, query),
      sellerSalesService.scopes(actor, scopePage),
    ]);
    return <SellerSalesReportView report={report} query={query} scopes={scopes} locale={locale} />;
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/workspace/sales/report" className="text-accent underline">
            {c.reset}
          </Link>
        </section>
      );
    throw error;
  }
}
