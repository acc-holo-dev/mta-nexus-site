import type { CommercialPlanTerms } from "@nexus/domain";
import { formatHistoryAmount } from "../lib/commerce-history-format";
import { planReviewsCopy } from "../lib/plan-reviews-i18n";
export function PlanReviewTerms({
  terms,
  locale,
}: {
  terms: CommercialPlanTerms;
  locale: "en" | "ru";
}) {
  const c = planReviewsCopy(locale);
  return (
    <div className="space-y-3">
      <h3 className="break-words text-xl font-semibold">
        {locale === "ru" ? terms.titleRu : terms.titleEn}
      </h3>
      <p className="whitespace-pre-wrap break-words text-sm text-secondary">
        {locale === "ru" ? terms.descriptionRu : terms.descriptionEn}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt>{c.price}</dt>
          <dd className="font-numeric">
            {formatHistoryAmount(terms.price, terms.currency, locale)}
          </dd>
        </div>
        <div>
          <dt>{c.term}</dt>
          <dd>
            {terms.durationDays} {c.days}
          </dd>
        </div>
        <div>
          <dt>{c.commission}</dt>
          <dd>{(terms.commissionBps / 100).toLocaleString(locale)}%</dd>
        </div>
      </dl>
    </div>
  );
}
