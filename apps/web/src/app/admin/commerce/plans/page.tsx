import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { formatHistoryAmount, parseHistoryPage } from "../../../../lib/commerce-history-format";
import { getCommercialCopy } from "../../../../lib/commercial-i18n";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { commercialPlanService } from "../../../../lib/services/commercial-plan-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Commercial plans | MTA NEXUS",
  robots: { index: false, follow: false },
};
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export default async function CommercialPlansAdmin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getCommercialCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/commerce/plans" />;
  if (user.role !== "admin") notFound();
  const status = (["draft", "published", "archived"] as const).find(
    (value) => value === query.status,
  );
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const filtersActive = Boolean(status);
  const returnHref = (() => {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
    });
    return params.size ? `/admin/commerce/plans?${params}` : "/admin/commerce/plans";
  })();
  let forbidden = false;
  const result = await commercialPlanService.adminPage(user, pageNumber, status).catch((error) => {
    if (error instanceof AppError && error.statusCode === 403) {
      forbidden = true;
      return null;
    }
    return null;
  });
  if (forbidden) notFound();
  const href = (page: number) =>
    `?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`;

  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin" className={linkClass}>
          {copy.adminBack}
        </Link>
        <ErrorState
          id="admin-commerce-plans-unavailable"
          title={copy.loadUnavailable}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin" className={linkClass}>
        {copy.adminBack}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-primary">{copy.admin}</h1>
        <Link
          href="/admin/commerce/plans/new"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-nexus-sm transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
        >
          {copy.newPlan}
        </Link>
      </header>
      <p role="note" className="text-sm text-secondary">
        {copy.planNote}
      </p>
      <nav aria-label={copy.status} className="flex flex-wrap gap-3">
        <Link
          href="/admin/commerce/plans"
          aria-current={!status ? "page" : undefined}
          className={linkClass}
        >
          {copy.all}
        </Link>
        {(["draft", "published", "archived"] as const).map((value) => (
          <Link
            key={value}
            href={`?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className={linkClass}
          >
            {copy[value]}
          </Link>
        ))}
        {filtersActive ? (
          <Link href="/admin/commerce/plans" className={linkClass}>
            {copy.clearFilters}
          </Link>
        ) : null}
      </nav>
      {result.plans.length ? (
        <ul className="space-y-3">
          {result.plans.map((plan) => (
            <li key={plan.id} className="nexus-panel min-w-0 space-y-2 p-5">
              <Link
                href={`/admin/commerce/plans/${encodeURIComponent(plan.id)}`}
                className={`break-words font-semibold ${linkClass}`}
              >
                {locale === "ru" ? plan.titleRu : plan.titleEn}
              </Link>
              <p className="text-sm text-secondary">
                {copy[plan.status]} · {copy[plan.scope]} · {copy.revision} {plan.revision}
              </p>
              <p className="text-sm text-primary">
                {formatHistoryAmount(plan.price, plan.currency, locale)} · {plan.durationDays}{" "}
                {copy.days} · {(plan.commissionBps / 100).toLocaleString(locale)}%
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.planNote}
          icon={<CreditCard className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="/admin/commerce/plans" className={linkClass}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
