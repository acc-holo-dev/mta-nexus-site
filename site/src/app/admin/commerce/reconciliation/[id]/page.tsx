import { financialReviewRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";
import {
  financialFlags,
  financialOrderLabel,
  financialPaymentLabel,
  formatFinancialMinor,
  getFinancialCopy,
} from "../../../../../lib/financial-i18n";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { orderTermsCopy } from "../../../../../lib/order-terms-i18n";
import { authService } from "../../../../../lib/services/auth-service";
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
  const copy = getFinancialCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/admin/commerce/reconciliation/${encodeURIComponent(id)}`}
      />
    );
  if (user.role !== "admin") notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const returnHref =
    pageNumber > 1
      ? `/admin/commerce/reconciliation/${encodeURIComponent(id)}?page=${pageNumber}`
      : `/admin/commerce/reconciliation/${encodeURIComponent(id)}`;
  let missing = false;
  const result = await financialReviewRepository.detail(user.id, id, pageNumber).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  const linkClass =
    "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin/commerce/reconciliation" className={linkClass}>
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
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin/commerce/reconciliation" className={linkClass}>
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">{result.order.orderNumber}</h1>
      <Link
        href={`/admin/commerce/reconciliation/${encodeURIComponent(id)}/terms`}
        className={linkClass}
      >
        {orderTermsCopy(locale).title}
      </Link>
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
            <li key={attempt.id} className="nexus-panel min-w-0 space-y-2 p-5">
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
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkClass}>
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
