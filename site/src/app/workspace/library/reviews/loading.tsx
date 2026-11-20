import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "library-reviews-loading-heading",
    titleKey: "own",
    loadingKey: "pageLoading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}
