import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../../lib/resource-review-i18n";

// Honest loading shell for /admin/commerce/reviews/[id].
export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="admin-commerce-review-detail-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="admin-commerce-review-detail-loading-heading" className="font-display text-primary">
          {copy.detail}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
