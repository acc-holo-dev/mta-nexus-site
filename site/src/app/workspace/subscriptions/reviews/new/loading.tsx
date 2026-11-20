import { PlanReviewsRouteLoading } from "../../../../../features/commerce/plan-reviews-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-review-new-loading-heading",
    className: pageShellMax5xl,
    rows: 0,
    leading: (
      <>
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
    titleKey: "newReview",
  });
}
