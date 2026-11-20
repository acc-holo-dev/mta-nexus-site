import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { sellerSalesService } from "../../../lib/services/commerce/seller-sales-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax6xl, pageShellMax6xlDense } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { sellerSalesCopy } from "../seller-sales-i18n";
import { sellerSalesPageQuery } from "../seller-sales-query";
import { SellerSalesReportView } from "./seller-sales-report";

type Query = Record<string, string | string[] | undefined>;

export async function sellerSalesReportMetadata(): Promise<Metadata> {
  return {
    title: `${sellerSalesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

async function SellerSalesReportScreen({ query }: { query: Query }) {
  const [store, locale] = await Promise.all([cookies(), getRequestLocale()]),
    c = sellerSalesCopy(locale);
  const dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={c.loadUnavailable}
        retryHref={"/workspace/sales/report"}
      />
    );
  }

  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") pageParams.set(key, value);
  }
  const returnPath = `/workspace/sales/report${pageParams.size ? `?${pageParams}` : ""}`;
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  try {
    const normalized = { ...query };
    if (normalized.currency === "all") delete normalized.currency;
    if (normalized.productId === "") delete normalized.productId;
    const { query: reportQuery, scopePage } = sellerSalesPageQuery(normalized);
    const [report, scopes] = await Promise.all([
      sellerSalesService.report(actor, reportQuery).catch((error) => {
        if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
        return null;
      }),
      sellerSalesService.scopes(actor, scopePage).catch(() => null),
    ]);
    if (!report || !scopes) {
      return (
        <div className={pageShellMax6xl}>
          <Link href="/workspace/sales" className={linkAccentSmRounded}>
            {c.back}
          </Link>
          <ErrorState
            title={c.loadUnavailable}
            description={c.loadUnavailableHint}
            action={
              <Link href={returnPath} className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    return (
      <SellerSalesReportView report={report} query={reportQuery} scopes={scopes} locale={locale} />
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_NOT_FOUND") throw error;
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={pageShellMax6xlDense}>
          <ErrorState
            title={c.invalid}
            description={c.invalidDescription}
            action={
              <Link href="/workspace/sales/report" className={linkAccentSmRounded}>
                {c.reset}
              </Link>
            }
          />
        </section>
      );
    return (
      <div className={pageShellMax6xl}>
        <Link href="/workspace/sales" className={linkAccentSmRounded}>
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
}

export async function WorkspaceSellerSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SellerSalesReportScreen({ query: await searchParams });
}
