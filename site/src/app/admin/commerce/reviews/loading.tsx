import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "admin-commerce-reviews-loading-heading",
    titleKey: "queue",
  });
}
