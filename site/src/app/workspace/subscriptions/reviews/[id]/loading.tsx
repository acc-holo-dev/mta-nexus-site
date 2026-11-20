import { PlanReviewsRouteLoading } from "../../../../../features/commerce/plan-reviews-route-loading-server";
import { pageShellMax5xl } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-review-detail-loading-heading",
    className: pageShellMax5xl,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "saved",
  });
}
