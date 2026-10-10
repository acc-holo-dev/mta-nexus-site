import type { Metadata } from "next";
import Link from "next/link";
import { CommercialFeeCalculator } from "../../components/commercial-fee-calculator";
import { commercialPlanService } from "../../lib/services/commercial-plan-service";
import { getRequestLocale } from "../../lib/i18n-server";
import { getCommercialCopy } from "../../lib/commercial-i18n";
import { formatHistoryAmount, parseHistoryPage } from "../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscriptions and commissions | MTA NEXUS" };
export default async function SubscriptionCatalog({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const copy = getCommercialCopy(locale),
    scope = query.scope === "organization" ? "organization" : "user";
  const result = await commercialPlanService.catalog(
    scope,
    Math.min(parseHistoryPage(query.page), 1000),
  );
  const href = (page: number) =>
    `/subscriptions?${new URLSearchParams({ scope, page: String(page) })}`;
  const estimates = result.plans.map((plan) => ({
    id: plan.id,
    title: locale === "ru" ? plan.titleRu : plan.titleEn,
    revision: plan.revision,
    commissionBps: plan.commissionBps,
  }));
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <h1 className="font-display text-primary">{copy.catalog}</h1>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {copy.planNote}
      </p>
      <nav aria-label={copy.scope} className="flex flex-wrap gap-3">
        {(["user", "organization"] as const).map((value) => (
          <Link
            key={value}
            href={`/subscriptions?scope=${value}`}
            aria-current={scope === value ? "page" : undefined}
            className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy[value]}
          </Link>
        ))}
      </nav>
      {result.plans.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.plans.map((plan) => (
            <li key={plan.id} className="nexus-panel space-y-3 p-5">
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
              <button
                type="button"
                disabled
                className="rounded-md border border-base px-4 py-2 text-sm text-muted"
              >
                {copy.unavailable}
              </button>
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
      <CommercialFeeCalculator
        key={`${locale}:${scope}:${estimates.map((plan) => `${plan.id}:${plan.revision}`).join(",")}`}
        plans={estimates}
      />
    </div>
  );
}
