import { PlanReviewsRouteLoading } from "../../../../../features/commerce/plan-reviews-route-loading-server";

export default async function Loading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-review-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "saved",
  });
}
