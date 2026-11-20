import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="market-reviews-loading-heading"
      title={copy.title}
      loadingLabel={copy.pageLoading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      rowClassName="h-28 rounded bg-inset"
    />
  );
}
