import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../lib/services/auth-service";
import { commercialPlanService } from "../../../../lib/services/commercial-plan-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getCommercialCopy } from "../../../../lib/commercial-i18n";
import { formatHistoryAmount, parseHistoryPage } from "../../../../lib/commerce-history-format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Commercial plans | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function CommercialPlansAdmin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getCommercialCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (user?.role !== "admin") notFound();
  const status = (["draft", "published", "archived"] as const).find(
    (value) => value === query.status,
  );
  const result = await commercialPlanService
    .adminPage(user, Math.min(parseHistoryPage(query.page), 1000), status)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) notFound();
      throw error;
    });
  const href = (page: number) =>
    `?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/admin" className="text-sm text-accent underline">
        {copy.adminBack}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-primary">{copy.admin}</h1>
        <Link
          href="/admin/commerce/plans/new"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-nexus-sm transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
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
          className="text-sm text-accent underline"
        >
          {copy.all}
        </Link>
        {(["draft", "published", "archived"] as const).map((value) => (
          <Link
            key={value}
            href={`?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className="text-sm text-accent underline"
          >
            {copy[value]}
          </Link>
        ))}
      </nav>
      {result.plans.length ? (
        <ul className="space-y-3">
          {result.plans.map((plan) => (
            <li key={plan.id} className="nexus-panel space-y-2 p-5">
              <Link
                href={`/admin/commerce/plans/${encodeURIComponent(plan.id)}`}
                className="break-words font-semibold text-accent underline"
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
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
