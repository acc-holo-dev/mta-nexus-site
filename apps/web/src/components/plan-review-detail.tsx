import type { PlanReviewDetail } from "@nexus/domain";
import Link from "next/link";
import { formatHistoryAmount, formatHistoryDate } from "../lib/commerce-history-format";
import { planReviewsCopy } from "../lib/plan-reviews-i18n";
import { PlanReviewTerms } from "./plan-review-terms";
export function PlanReviewDetailView({
  detail,
  locale,
  organizationId,
}: {
  detail: PlanReviewDetail;
  locale: "en" | "ru";
  organizationId?: string;
}) {
  const c = planReviewsCopy(locale),
    r = detail.review,
    context = organizationId ? `?${new URLSearchParams({ organizationId })}` : "";
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href={`/workspace/subscriptions/reviews${context}`} className="text-accent underline">
        {c.history}
      </Link>
      <h1 className="font-display">{c.saved}</h1>
      <p role="note" className="text-sm text-secondary">
        {c.notice}
      </p>
      <section className="nexus-panel space-y-4 p-5">
        <p>
          {c.revision} {r.planRevision} ·{" "}
          <time dateTime={r.createdAt.toISOString()}>{formatHistoryDate(r.createdAt, locale)}</time>
        </p>
        <PlanReviewTerms terms={r.terms} locale={locale} />
      </section>
      <section className="nexus-panel space-y-4 p-5">
        <h2 className="text-xl font-semibold">{c.estimate}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            [c.amount, r.estimate.grossAmount],
            [c.fee, r.estimate.platformFee],
            [c.proceeds, r.estimate.sellerProceeds],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>{formatHistoryAmount(Number(value), r.estimate.currency, locale)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">{c.baseline}</p>
      </section>
      <section className="nexus-panel space-y-4 p-5">
        <h2 className="text-xl font-semibold">{c.latest}</h2>
        <p role="status">{c[detail.state]}</p>
        <p className="text-sm text-muted">
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
            <PlanReviewTerms terms={detail.current.terms} locale={locale} />
            <Link
              href={`/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: r.planId, revision: String(detail.current.revision) })}`}
              className="text-accent underline"
            >
              {c.newReview}
            </Link>
          </>
        ) : null}
      </section>
      <a
        href={`/api/subscriptions/reviews/${encodeURIComponent(r.id)}/export${context}`}
        className="text-accent underline"
      >
        {c.export}
      </a>
    </div>
  );
}
