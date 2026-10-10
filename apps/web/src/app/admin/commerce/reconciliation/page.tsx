import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { financialReviewRepository } from "@nexus/db";
import { authService } from "../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import {
  getFinancialCopy,
  formatFinancialMinor,
  financialFlags,
  financialOrderLabel,
} from "../../../../lib/financial-i18n";
import { parseHistoryPage } from "../../../../lib/commerce-history-format";
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
  const copy = getFinancialCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (user?.role !== "admin") notFound();
  const filter = query.filter === "all" ? "all" : "review";
  const result = await financialReviewRepository
    .page(user.id, Math.min(parseHistoryPage(query.page), 1000), filter)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) notFound();
      throw error;
    });
  const href = (page: number) => `?${new URLSearchParams({ filter, page: String(page) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/admin" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.review}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.reviewNote}
      </p>
      <nav className="flex gap-4 text-sm" aria-label={copy.review}>
        <Link href="?filter=review" className="text-accent underline">
          {copy.reviewOnly}
        </Link>
        <Link href="?filter=all" className="text-accent underline">
          {copy.allOrders}
        </Link>
      </nav>
      {result.orders.length ? (
        <ul className="space-y-4">
          {result.orders.map((order) => (
            <li key={order.id} className="nexus-panel space-y-3 p-5">
              <Link
                href={`/admin/commerce/reconciliation/${encodeURIComponent(order.id)}`}
                className="break-words font-semibold text-accent underline"
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
