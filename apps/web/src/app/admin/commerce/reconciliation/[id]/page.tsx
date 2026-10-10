import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { financialReviewRepository } from "@nexus/db";
import { authService } from "../../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  getFinancialCopy,
  formatFinancialMinor,
  financialFlags,
  financialOrderLabel,
  financialPaymentLabel,
} from "../../../../../lib/financial-i18n";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recorded financial evidence | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ReconciliationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getFinancialCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (user?.role !== "admin") notFound();
  const result = await financialReviewRepository
    .detail(user.id, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/commerce/reconciliation" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">{result.order.orderNumber}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.reviewNote}
      </p>
      <p>
        {financialOrderLabel(locale, result.order.status)} ·{" "}
        {formatFinancialMinor(result.order.amount, result.order.currency, locale)}
      </p>
      <ul className="space-y-2 text-sm text-secondary">
        {financialFlags
          .filter((flag) => result.order[flag])
          .map((flag) => (
            <li key={flag}>{copy[flag]}</li>
          ))}
      </ul>
      <h2 className="text-lg font-semibold">{copy.details}</h2>
      {result.attempts.length ? (
        <ol className="space-y-3">
          {result.attempts.map((attempt) => (
            <li key={attempt.id} className="nexus-panel space-y-2 p-5">
              <p className="text-sm">
                {financialPaymentLabel(locale, attempt.status)} ·{" "}
                {formatFinancialMinor(attempt.amount, attempt.currency, locale)}
              </p>
              <time dateTime={attempt.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(attempt.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
      <h2 className="text-lg font-semibold">{copy.ledger}</h2>
      <ul className="space-y-2 text-sm">
        {result.ledgerTotals.map((total) => (
          <li key={total.currency}>
            {formatFinancialMinor(total.net, total.currency, locale)} · {total.entries}
          </li>
        ))}
      </ul>
    </div>
  );
}
