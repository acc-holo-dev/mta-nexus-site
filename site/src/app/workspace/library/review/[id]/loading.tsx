import { resourceReviewCopy } from "../../../../../features/resources/resource-review-i18n";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/library/review/[id].
export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="library-review-loading-heading"
      title={copy.write}
      loadingLabel={copy.pageLoading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
