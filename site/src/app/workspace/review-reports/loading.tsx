import { resourceReviewCopy } from "../../../features/resources/resource-review-i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = resourceReviewCopy(typedLocale);
  return (
    <RouteHonestLoading
      headingId="review-reports-loading-heading"
      title={copy.reports}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
