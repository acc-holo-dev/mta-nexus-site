import { resourceReviewCopy } from "../../../../../features/resources/resource-review-i18n";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = resourceReviewCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="library-review-loading-heading"
      title={copy.write}
      loadingLabel={copy.pageLoading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
