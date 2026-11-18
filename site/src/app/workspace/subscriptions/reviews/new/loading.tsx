import { planReviewsCopy } from "../../../../../features/commerce/plan-reviews-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

// Honest loading shell for /workspace/subscriptions/reviews/new.
export default async function Loading() {
  const copy = planReviewsCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="subscription-review-new-loading-heading"
      title={copy.newReview}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
