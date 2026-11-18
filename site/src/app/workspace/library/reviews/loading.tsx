import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/library/reviews.
export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headingId="library-reviews-loading-heading"
      title={copy.own}
      loadingLabel={copy.pageLoading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
