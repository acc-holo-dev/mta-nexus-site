import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "market-reviews-loading-heading",
    titleKey: "title",
    loadingKey: "pageLoading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}
