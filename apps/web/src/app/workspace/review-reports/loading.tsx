import { getRequestLocale } from "../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";

// Honest loading shell for /workspace/review-reports.
export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-labelledby="review-reports-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="review-reports-loading-heading" className="font-display text-primary">
          {copy.reports}
        </h1>
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-28 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
