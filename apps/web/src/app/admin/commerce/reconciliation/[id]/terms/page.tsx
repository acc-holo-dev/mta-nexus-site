import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTermsReportView } from "../../../../../../components/order-terms-report";
import { PlatformSignIn } from "../../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../../lib/i18n";
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
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/admin/commerce/reconciliation/${encodeURIComponent(id)}/terms`}
      />
    );
  if (actor.role !== "admin") notFound();
  const returnHref = (() => {
    const page = typeof query.page === "string" ? query.page : undefined;
    const base = `/admin/commerce/reconciliation/${encodeURIComponent(id)}/terms`;
    return page ? `${base}?page=${encodeURIComponent(page)}` : base;
  })();
  const linkClass =
    "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
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
    if (error instanceof AppError && error.statusCode === 400) {
      return (
        <section className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/admin/commerce/reconciliation" className={linkClass}>
            {c.back}
          </Link>
        </section>
      );
    }
    return (
      <section className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href={`/admin/commerce/reconciliation/${encodeURIComponent(id)}`}
          className={linkClass}
        >
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
