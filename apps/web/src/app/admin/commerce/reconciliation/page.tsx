import { financialReviewRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { parseHistoryPage } from "../../../../lib/commerce-history-format";
import {
  financialFlags,
  financialOrderLabel,
  formatFinancialMinor,
  getFinancialCopy,
} from "../../../../lib/financial-i18n";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financial reconciliation | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function Reconciliation({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getFinancialCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/commerce/reconciliation" />;
  if (user.role !== "admin") notFound();
  const filter = query.filter === "all" ? "all" : "review";
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const filtersActive = filter === "review";
  const returnHref = (() => {
    const params = new URLSearchParams({
      filter,
      ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
    });
    return `/admin/commerce/reconciliation?${params}`;
  })();
  let forbidden = false;
  const result = await financialReviewRepository
    .page(user.id, pageNumber, filter)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) {
        forbidden = true;
        return null;
      }
      return null;
    });
  if (forbidden) notFound();
  const href = (page: number) => `?${new URLSearchParams({ filter, page: String(page) })}`;
  const linkClass =
    "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin" className={linkClass}>
          {copy.back}
        </Link>
        <ErrorState
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
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.review}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.reviewNote}
      </p>
      <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.review}>
        <Link href="?filter=review" className={linkClass}>
          {copy.reviewOnly}
        </Link>
        <Link href="?filter=all" className={linkClass}>
          {copy.allOrders}
        </Link>
        {filtersActive ? (
          <Link href="?filter=all" className={linkClass}>
            {copy.clearFilters}
          </Link>
        ) : null}
      </nav>
      {result.orders.length ? (
        <ul className="space-y-4">
          {result.orders.map((order) => (
            <li key={order.id} className="nexus-panel min-w-0 space-y-3 p-5">
              <Link
                href={`/admin/commerce/reconciliation/${encodeURIComponent(order.id)}`}
                className="break-words font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {order.orderNumber}
              </Link>
              <p className="text-sm text-secondary">
                {financialOrderLabel(locale, order.status)} ·{" "}
                {formatFinancialMinor(order.amount, order.currency, locale)}
              </p>
              <ul className="space-y-1 text-sm text-secondary">
                {financialFlags
                  .filter((flag) => order[flag])
                  .map((flag) => (
                    <li key={flag}>{copy[flag]}</li>
                  ))}
              </ul>
              {financialFlags.some((flag) => order[flag]) ? null : (
                <p className="text-sm text-muted">{copy.clear}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.reviewNote}
          icon={<Receipt className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link href="?filter=all" className={linkClass}>
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
