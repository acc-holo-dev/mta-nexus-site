import { planReviewsCopy } from "../../../../../features/commerce/plan-reviews-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "subscription-review-new-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 0,
    leading: (
      <>
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
    load: (locale) => {
      const copy = planReviewsCopy(locale);
      return {
        title: copy.newReview,
        loading: copy.loading,
      };
    },
  });
}
