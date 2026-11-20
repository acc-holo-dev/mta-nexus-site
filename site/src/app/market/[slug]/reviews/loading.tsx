import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "market-reviews-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-28 rounded bg-inset",
    load: (locale) => {
      const copy = resourceReviewCopy(locale);
      return {
        title: copy.title,
        loading: copy.pageLoading,
      };
    },
  });
}
