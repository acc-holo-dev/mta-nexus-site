import { getRequestLocale } from "../../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../../lib/plan-reviews-i18n";

// Honest loading shell for /workspace/subscriptions/reviews/[id].
export default async function Loading() {
  const copy = planReviewsCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="subscription-review-detail-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="subscription-review-detail-loading-heading" className="font-display text-primary">
          {copy.saved}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
