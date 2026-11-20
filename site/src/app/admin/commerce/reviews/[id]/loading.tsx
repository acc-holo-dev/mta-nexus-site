import { ResourceReviewRouteLoading } from "../../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "admin-commerce-review-detail-loading-heading",
    titleKey: "detail",
  });
}
