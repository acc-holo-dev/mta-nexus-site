import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHistoryAmount, formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../lib/plan-reviews-i18n";
import {
  planReviewHref,
  planReviewsPageParams,
  planReviewsQuery,
} from "../../../../lib/plan-reviews-query";
import { authService } from "../../../../lib/services/auth-service";
import { planReviewsService } from "../../../../lib/services/plan-reviews-service";
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
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  try {
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
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <Link href="/subscriptions" className="text-accent underline">
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
          <Button type="submit">{c.apply}</Button>
        </form>
        {scopes.totalPages > 1 ? (
          <nav aria-label={c.scopeNext} className="flex gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link href={href(result.page, scopes.page - 1)} className="text-accent underline">
                {c.previous}
              </Link>
            ) : null}
            <span>
              {c.scopeNext} · {scopes.page} / {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link href={href(result.page, scopes.page + 1)} className="text-accent underline">
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
                  className="break-words text-lg text-accent underline"
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
          <p>{c.empty}</p>
        )}
        {result.totalPages > 1 ? (
          <nav aria-label={c.page} className="flex gap-4 text-sm">
            {result.page > 1 ? (
              <Link href={href(result.page - 1)} className="text-accent underline">
                {c.previous}
              </Link>
            ) : null}
            <span>
              {c.page} {result.page} {c.of} {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={href(result.page + 1)} className="text-accent underline">
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
        <section className="space-y-4 py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/workspace/subscriptions/reviews" className="text-accent underline">
            {c.title}
          </Link>
        </section>
      );
    throw error;
  }
}
