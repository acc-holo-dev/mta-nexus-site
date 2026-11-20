import { planReviewsCopy } from "../../../../../features/commerce/plan-reviews-i18n";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = planReviewsCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="subscription-review-detail-loading-heading"
      title={copy.saved}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
