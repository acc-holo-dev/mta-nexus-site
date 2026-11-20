import { financialReviewRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkAccentTightBreakSemibold, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeSmSecondary,
  typeSpace1SmSecondary,
} from "../../shell/type-shell";
import { parseHistoryPage } from "../commerce-history-format";
import {
  financialFlags,
  financialOrderLabel,
  formatFinancialMinor,
  getFinancialCopy,
} from "../financial-i18n";

export async function financialReconciliationMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).review} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function FinancialReconciliationScreen({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
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
        retryHref={"/admin/commerce/reconciliation"}
      />
    );
  }

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

  if (!result) {
    return (
      <div className={pageShellMax5xl}>
        <Link href="/admin" className={linkAccentSm}>
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
    <div className={pageShellMax5xl}>
      <Link href="/admin" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.review}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.reviewNote}
      </p>
      <nav className={typeFlexWrapGap4Sm} aria-label={copy.review}>
        <Link href="?filter=review" className={linkAccentSm}>
          {copy.reviewOnly}
        </Link>
        <Link href="?filter=all" className={linkAccentSm}>
          {copy.allOrders}
        </Link>
        {filtersActive ? (
          <Link href="?filter=all" className={linkAccentSm}>
            {copy.clearFilters}
          </Link>
        ) : null}
      </nav>
      {result.orders.length ? (
        <ul className="space-y-4">
          {result.orders.map((order) => (
            <li key={order.id} className={panelMinSpace3P5}>
              <Link
                href={`/admin/commerce/reconciliation/${encodeURIComponent(order.id)}`}
                className={linkAccentTightBreakSemibold}
              >
                {order.orderNumber}
              </Link>
              <p className={typeSmSecondary}>
                {financialOrderLabel(locale, order.status)} ·{" "}
                {formatFinancialMinor(order.amount, order.currency, locale)}
              </p>
              <ul className={typeSpace1SmSecondary}>
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
              <Link href="?filter=all" className={linkAccentSm}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSm}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
