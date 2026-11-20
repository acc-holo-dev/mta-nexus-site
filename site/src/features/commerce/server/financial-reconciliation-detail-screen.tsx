import { financialReviewRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { formatHistoryDate, parseHistoryPage } from "../commerce-history-format";
import {
  financialFlags,
  financialOrderLabel,
  financialPaymentLabel,
  formatFinancialMinor,
  getFinancialCopy,
} from "../financial-i18n";
import { orderTermsCopy } from "../order-terms-i18n";

export async function financialReconciliationDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).evidenceDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function FinancialReconciliationDetailScreen({
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
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/commerce/reconciliation/"}
      />
    );
  }

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

  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/admin/commerce/reconciliation" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={pageShellMax4xl}>
      <Link href="/admin/commerce/reconciliation" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">{result.order.orderNumber}</h1>
      <Link
        href={`/admin/commerce/reconciliation/${encodeURIComponent(id)}/terms`}
        className={linkAccentSm}
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
            <li key={attempt.id} className={panelMinSpace2P5}>
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
            <Link href={`?page=${result.page - 1}`} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSm}>
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
