import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { planReviewNavLinkClass } from "../../../../components/plan-review-workspace-recovery";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { formatHistoryAmount, formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../lib/plan-reviews-i18n";
import {
  planReviewHref,
  planReviewsPageParams,
  planReviewsQuery,
} from "../../../../lib/plan-reviews-query";
import { authService } from "../../../../lib/services/auth-service";
import { planReviewsService } from "../../../../lib/services/plan-reviews-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Saved plan reviews | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function PlanReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, params] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = planReviewsCopy(locale),
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    const query = planReviewsPageParams(params);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/subscriptions/reviews${query.size ? `?${query}` : ""}`}
      />
    );
  }
  let recoveryRetry = "/workspace/subscriptions/reviews";
  try {
    const pageQuery = planReviewsPageParams(params);
    recoveryRetry = `/workspace/subscriptions/reviews${pageQuery.size ? `?${pageQuery}` : ""}`;
    const normalized = { ...params };
    if (normalized.organizationId === "") delete normalized.organizationId;
    const query = planReviewsQuery(planReviewsPageParams(normalized));
    const [result, scopes] = await Promise.all([
      planReviewsService.page(actor, query),
      planReviewsService.scopes(actor, query.scopePage),
    ]);
    const href = (page: number, scopePage = scopes.page) =>
      `/workspace/subscriptions/reviews?${new URLSearchParams({ page: String(page), scopePage: String(scopePage), days: String(query.days), ...(query.organizationId ? { organizationId: query.organizationId } : {}) })}`;
    return (
      <div className={pageShellClass}>
        <Link href="/subscriptions" className={planReviewNavLinkClass}>
          {c.back}
        </Link>
        <h1 className="font-display">{c.title}</h1>
        <p role="note" className="text-sm text-secondary">
          {c.notice}
        </p>
        <form method="get" className="nexus-panel flex flex-wrap items-end gap-4 p-4">
          <label htmlFor="review-account">
            <span className="block text-sm">{c.account}</span>
            <select
              id="review-account"
              name="organizationId"
              defaultValue={query.organizationId ?? ""}
              className="rounded border border-base bg-surface p-2"
            >
              <option value="">{c.personal}</option>
              {query.organizationId && !scopes.scopes.some((o) => o.id === query.organizationId) ? (
                <option value={query.organizationId}>{result.scope.name}</option>
              ) : null}
              {scopes.scopes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="review-days">
            <span className="block text-sm">{c.period}</span>
            <select
              id="review-days"
              name="days"
              defaultValue={String(query.days)}
              className="rounded border border-base bg-surface p-2"
            >
              <option value="all">{c.all}</option>
              {[7, 30, 90, 365].map((v) => (
                <option key={v} value={v}>
                  {v} {c.days}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="scopePage" value={scopes.page} />
          <Button type="submit" size="touch" variant="outline">
            {c.apply}
          </Button>
        </form>
        {scopes.totalPages > 1 ? (
          <nav aria-label={c.scopeNext} className="flex flex-wrap gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link href={href(result.page, scopes.page - 1)} className={planReviewNavLinkClass}>
                {c.previous}
              </Link>
            ) : null}
            <span className="inline-flex min-h-11 items-center">
              {c.scopeNext} · {scopes.page} / {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link href={href(result.page, scopes.page + 1)} className={planReviewNavLinkClass}>
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
        {result.reviews.length ? (
          <ol className="space-y-4">
            {result.reviews.map((r) => (
              <li key={r.id} className="nexus-panel space-y-3 p-5">
                <Link
                  href={planReviewHref(r.id, query.organizationId)}
                  className={`${planReviewNavLinkClass} break-words text-lg`}
                >
                  {locale === "ru" ? r.terms.titleRu : r.terms.titleEn}
                </Link>
                <p className="text-sm">
                  {c.revision} {r.planRevision} ·{" "}
                  <time dateTime={r.createdAt.toISOString()}>
                    {formatHistoryDate(r.createdAt, locale)}
                  </time>
                </p>
                <p className="text-sm">
                  {formatHistoryAmount(r.terms.price, r.terms.currency, locale)} ·{" "}
                  {r.terms.durationDays} {c.days} · {c.commission}: {r.terms.commissionBps / 100}%
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={c.empty} description={c.emptyHint} />
        )}
        {result.totalPages > 1 ? (
          <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
            {result.page > 1 ? (
              <Link href={href(result.page - 1)} className={planReviewNavLinkClass}>
                {c.previous}
              </Link>
            ) : null}
            <span className="inline-flex min-h-11 items-center">
              {c.page} {result.page} {c.of} {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={href(result.page + 1)} className={planReviewNavLinkClass}>
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={pageShellClass}>
          <ErrorState
            id="subscription-reviews-invalid"
            title={c.invalid}
            description={c.selectionRecoverHint}
            action={
              <Link href="/workspace/subscriptions/reviews" className={planReviewNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link href="/subscriptions" className={planReviewNavLinkClass}>
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={recoveryRetry} className={planReviewNavLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
