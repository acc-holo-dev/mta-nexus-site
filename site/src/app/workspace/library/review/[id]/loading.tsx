import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../../lib/resource-review-i18n";

// Honest loading shell for /workspace/library/review/[id].
export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="library-review-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="library-review-loading-heading" className="font-display text-primary">
          {copy.write}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.pageLoading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
