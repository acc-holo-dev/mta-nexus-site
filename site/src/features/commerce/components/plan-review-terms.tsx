import type { CommercialPlanTerms } from "@nexus/domain";
import { typeGridGap3Sm3, typePrewrapSmSecondary } from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { planReviewsCopy } from "../plan-reviews-i18n";
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
      <p className={typePrewrapSmSecondary}>
        {locale === "ru" ? terms.descriptionRu : terms.descriptionEn}
      </p>
      <dl className={typeGridGap3Sm3}>
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
