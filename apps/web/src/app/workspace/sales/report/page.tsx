import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { SellerSalesReportView } from "../../../../components/seller-sales-report";
import { getDictionary } from "../../../../lib/i18n";
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

const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function SellerSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, params] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = sellerSalesCopy(locale);
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") pageParams.set(key, value);
  }
  const returnPath = `/workspace/sales/report${pageParams.size ? `?${pageParams}` : ""}`;
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  try {
    const normalized = { ...params };
    if (normalized.currency === "all") delete normalized.currency;
    if (normalized.productId === "") delete normalized.productId;
    const { query, scopePage } = sellerSalesPageQuery(normalized);
    const [report, scopes] = await Promise.all([
      sellerSalesService.report(actor, query).catch((error) => {
        if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
        return null;
      }),
      sellerSalesService.scopes(actor, scopePage).catch(() => null),
    ]);
    if (!report || !scopes) {
      return (
        <div className="mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8">
          <Link href="/workspace/sales" className={linkClass}>
            {c.back}
          </Link>
          <ErrorState
            id="workspace-sales-report-unavailable"
            title={c.loadUnavailable}
            description={c.loadUnavailableHint}
            action={
              <Link href={returnPath} className={linkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    return <SellerSalesReportView report={report} query={query} scopes={scopes} locale={locale} />;
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_NOT_FOUND") throw error;
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-clip py-8">
          <ErrorState
            title={c.invalid}
            description={c.invalidDescription}
            action={
              <Link href="/workspace/sales/report" className={linkClass}>
                {c.reset}
              </Link>
            }
          />
        </section>
      );
    return (
      <div className="mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8">
        <Link href="/workspace/sales" className={linkClass}>
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
}
