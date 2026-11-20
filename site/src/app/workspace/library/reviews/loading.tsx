import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "library-reviews-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rowClassName: "h-28 rounded bg-inset",
    load: (locale) => {
      const copy = resourceReviewCopy(locale);
      return {
        title: copy.own,
        loading: copy.pageLoading,
      };
    },
  });
}
