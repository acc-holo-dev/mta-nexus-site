import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommercialFeeCalculator } from "../../components/commercial-fee-calculator";
import { formatHistoryAmount, parseHistoryPage } from "../../lib/commerce-history-format";
import { getCommercialCopy } from "../../lib/commercial-i18n";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { planReviewsCopy } from "../../lib/plan-reviews-i18n";
import { commercialPlanService } from "../../lib/services/commercial-plan-service";
import { subscriptionsCopy } from "../../lib/subscriptions-i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscriptions and commissions | MTA NEXUS" };

const shellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const scopeLinkClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function SubscriptionCatalog({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const copy = getCommercialCopy(locale);
  const dictionary = getDictionary(locale);
  const subscriptions = subscriptionsCopy(locale);
  const reviews = planReviewsCopy(locale);
  const scope = query.scope === "organization" ? "organization" : "user";
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const returnHref = `/subscriptions?${new URLSearchParams({
    scope,
    ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
  })}`;
  const result = await commercialPlanService.catalog(scope, pageNumber).catch(() => null);
  const href = (page: number) =>
    `/subscriptions?${new URLSearchParams({ scope, page: String(page) })}`;

  if (!result) {
    return (
      <div className={shellClass}>
        <h1 className="font-display text-primary">{copy.catalog}</h1>
        <ErrorState
          id="subscriptions-unavailable"
          title={copy.loadUnavailable}
          description={subscriptions.notice}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const estimates = result.plans.map((plan) => ({
    id: plan.id,
    title: locale === "ru" ? plan.titleRu : plan.titleEn,
    revision: plan.revision,
    commissionBps: plan.commissionBps,
  }));

  return (
    <div className={shellClass}>
      <h1 className="font-display text-primary">{copy.catalog}</h1>
      <nav className="flex min-w-0 flex-wrap gap-4" aria-label={copy.catalog}>
        <Link href="/workspace/subscriptions" className={linkClass}>
          {subscriptions.title}
        </Link>
        <Link href="/workspace/subscriptions/reviews" className={linkClass}>
          {reviews.history}
        </Link>
      </nav>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {subscriptions.notice}
      </p>
      <nav aria-label={copy.scope} className="flex min-w-0 flex-wrap gap-3">
        {(["user", "organization"] as const).map((value) => (
          <Link
            key={value}
            href={`/subscriptions?scope=${value}`}
            aria-current={scope === value ? "page" : undefined}
            className={scopeLinkClass}
          >
            {copy[value]}
          </Link>
        ))}
      </nav>
      {result.plans.length ? (
        <ul className="grid min-w-0 gap-4 overflow-x-clip sm:grid-cols-2">
          {result.plans.map((plan) => (
            <li key={plan.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <h2 className="break-words text-xl font-semibold text-primary">
                {locale === "ru" ? plan.titleRu : plan.titleEn}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                {locale === "ru" ? plan.descriptionRu : plan.descriptionEn}
              </p>
              <p className="font-numeric text-primary">
                {formatHistoryAmount(plan.price, plan.currency, locale)} · {plan.durationDays}{" "}
                {copy.days}
              </p>
              <p className="text-sm text-secondary">
                {copy.commission}: {(plan.commissionBps / 100).toLocaleString(locale)}%
              </p>
              <p className="text-xs text-muted">
                {copy.revision} {plan.revision} · {plan.slug}
              </p>
              {plan.price === 0 ? (
                <Link
                  href={`/workspace/subscriptions/activate?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision) })}`}
                  className={linkClass}
                >
                  {subscriptions.activate}
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  disabled
                  className="text-sm text-muted"
                >
                  {copy.unavailable}
                </Button>
              )}
              <Link
                href={`/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision) })}`}
                className={linkClass}
              >
                {reviews.newReview}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={copy.empty}
          description={copy.planNote}
          icon={<CreditCard className="h-6 w-6" aria-hidden="true" />}
          action={
            pageNumber > 1 ? (
              <Link href={`/subscriptions?scope=${scope}`} className={linkClass}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex min-w-0 flex-wrap gap-4 text-sm">
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
      <CommercialFeeCalculator
        key={`${locale}:${scope}:${estimates.map((plan) => `${plan.id}:${plan.revision}`).join(",")}`}
        plans={estimates}
      />
    </div>
  );
}
