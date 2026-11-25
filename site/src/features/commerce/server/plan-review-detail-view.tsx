import type { ExplicitFxRate, PlanReviewDetail } from "@nexus/domain";
import Link from "next/link";
import { linkAccentTightRounded } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { typeGridGap3Sm3, typeSmMuted, typeSmSecondary } from "../../shell/type-shell";
import { formatHistoryAmount, formatHistoryDate } from "../commerce-history-format";
import { PlanReviewTerms } from "../components/plan-review-terms";
import { RecordedRateEstimate } from "../components/recorded-rate-estimate";
import { planReviewsCopy } from "../plan-reviews-i18n";
export function PlanReviewDetailView({
  detail,
  locale,
  organizationId,
  rates,
}: {
  detail: PlanReviewDetail;
  locale: "en" | "ru";
  organizationId?: string;
  rates?: readonly ExplicitFxRate[] | null;
}) {
  const c = planReviewsCopy(locale),
    r = detail.review,
    context = organizationId ? `?${new URLSearchParams({ organizationId })}` : "";
  return (
    <div className={pageShellMax5xl}>
      <Link href={`/workspace/subscriptions/reviews${context}`} className={linkAccentTightRounded}>
        {c.history}
      </Link>
      <h1 className="font-display">{c.saved}</h1>
      <p role="note" className={typeSmSecondary}>
        {c.notice}
      </p>
      <section className={panelSpace4P5}>
        <p>
          {c.revision} {r.planRevision} ·{" "}
          <time dateTime={r.createdAt.toISOString()}>{formatHistoryDate(r.createdAt, locale)}</time>
        </p>
        <PlanReviewTerms terms={r.terms} locale={locale} rates={rates} />
      </section>
      <section className={panelSpace4P5}>
        <h2 className="text-xl font-semibold">{c.estimate}</h2>
        <dl className={typeGridGap3Sm3}>
          {[
            [c.amount, r.estimate.grossAmount],
            [c.fee, r.estimate.platformFee],
            [c.proceeds, r.estimate.sellerProceeds],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>
                {formatHistoryAmount(Number(value), r.estimate.currency, locale)}
                <RecordedRateEstimate
                  amount={Number(value)}
                  currency={r.estimate.currency}
                  locale={locale}
                  rates={rates}
                />
              </dd>
            </div>
          ))}
        </dl>
        <p className={typeSmMuted}>{c.baseline}</p>
      </section>
      <section className={panelSpace4P5}>
        <h2 className="text-xl font-semibold">{c.latest}</h2>
        <p role="status">{c[detail.state]}</p>
        <p className={typeSmMuted}>
          {c.observed}:{" "}
          <time dateTime={detail.observedAt.toISOString()}>
            {formatHistoryDate(detail.observedAt, locale)}
          </time>
        </p>
        {detail.current ? (
          <>
            <p>
              {c.revision} {detail.current.revision}
            </p>
            <PlanReviewTerms terms={detail.current.terms} locale={locale} rates={rates} />
            <Link
              href={`/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: r.planId, revision: String(detail.current.revision) })}`}
              className={linkAccentTightRounded}
            >
              {c.newReview}
            </Link>
          </>
        ) : null}
      </section>
      <a
        href={`/api/subscriptions/reviews/${encodeURIComponent(r.id)}/export${context}`}
        className={linkAccentTightRounded}
      >
        {c.export}
      </a>
    </div>
  );
}
