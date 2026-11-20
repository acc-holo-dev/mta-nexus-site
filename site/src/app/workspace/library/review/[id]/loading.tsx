import { ResourceReviewRouteLoading } from "../../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "library-review-loading-heading",
    titleKey: "write",
    loadingKey: "pageLoading",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
  });
}
