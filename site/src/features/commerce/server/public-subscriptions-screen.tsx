import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { commercialPlanService } from "../../../lib/services/commerce/commercial-plan-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelClipSpace3P5 } from "../../shell/panel-shell";
import { surfaceBgP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeDisplayPrimary,
  typeFlexMinWrapGap3,
  typeFlexMinWrapGap4,
  typeFlexMinWrapGap4Sm,
  typeGridMinGap4ClipSm2,
  typeNumericPrimary,
  typePrewrapSmSecondary,
  typeSmMuted,
  typeSmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";
import { formatHistoryAmount, parseHistoryPage } from "../commerce-history-format";
import { getCommercialCopy } from "../commercial-i18n";
import { CommercialFeeCalculator } from "../commercial-plans";
import { RecordedRateEstimate } from "../components/recorded-rate-estimate";
import { planReviewsCopy } from "../plan-reviews-i18n";
import { subscriptionsCopy } from "../subscriptions-i18n";

const shellClass = pageShellMax5xl;
const scopeLinkClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function publicSubscriptionsMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).catalog} | MTA NEXUS`,
  };
}

export async function PublicSubscriptionsScreen({
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
        <h1 className={typeDisplayPrimary}>{copy.catalog}</h1>
        <ErrorState
          title={copy.loadUnavailable}
          description={subscriptions.notice}
          action={
            <Link href={returnHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const fxRates = isWalletEngineEnabled()
    ? await new WalletPaymentService().listFxRates().catch(() => null)
    : undefined;
  const estimates = result.plans.map((plan) => ({
    id: plan.id,
    title: locale === "ru" ? plan.titleRu : plan.titleEn,
    revision: plan.revision,
    commissionBps: plan.commissionBps,
  }));

  return (
    <div className={shellClass}>
      <h1 className={typeDisplayPrimary}>{copy.catalog}</h1>
      <nav className={typeFlexMinWrapGap4} aria-label={copy.catalog}>
        <Link href="/workspace/subscriptions" className={linkAccentSm}>
          {subscriptions.title}
        </Link>
        <Link href="/workspace/subscriptions/reviews" className={linkAccentSm}>
          {reviews.history}
        </Link>
      </nav>
      <p role="note" className={surfaceBgP4TextSmSecondary}>
        {subscriptions.notice}
      </p>
      <nav aria-label={copy.scope} className={typeFlexMinWrapGap3}>
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
        <ul className={typeGridMinGap4ClipSm2}>
          {result.plans.map((plan) => (
            <li key={plan.id} className={panelClipSpace3P5}>
              <h2 className="break-words text-xl font-semibold text-primary">
                {locale === "ru" ? plan.titleRu : plan.titleEn}
              </h2>
              <p className={typePrewrapSmSecondary}>
                {locale === "ru" ? plan.descriptionRu : plan.descriptionEn}
              </p>
              <p className={typeNumericPrimary}>
                {formatHistoryAmount(plan.price, plan.currency, locale)} · {plan.durationDays}{" "}
                {copy.days}
                <RecordedRateEstimate
                  amount={plan.price}
                  currency={plan.currency}
                  locale={locale}
                  rates={fxRates}
                />
              </p>
              <p className={typeSmSecondary}>
                {copy.commission}: {(plan.commissionBps / 100).toLocaleString(locale)}%
              </p>
              <p className={typeXsMuted}>
                {copy.revision} {plan.revision} · {plan.slug}
              </p>
              {plan.price === 0 ? (
                <Link
                  href={`/workspace/subscriptions/activate?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision) })}`}
                  className={linkAccentSm}
                >
                  {subscriptions.activate}
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  disabled
                  className={typeSmMuted}
                >
                  {copy.unavailable}
                </Button>
              )}
              <Link
                href={`/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision) })}`}
                className={linkAccentSm}
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
              <Link href={`/subscriptions?scope=${scope}`} className={linkAccentSm}>
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexMinWrapGap4Sm}>
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
      <CommercialFeeCalculator
        key={`${locale}:${scope}:${estimates.map((plan) => `${plan.id}:${plan.revision}`).join(",")}`}
        plans={estimates}
        rates={fxRates}
      />
    </div>
  );
}
