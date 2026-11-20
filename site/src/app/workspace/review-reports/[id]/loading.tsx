import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "review-report-loading-heading",
    titleKey: "reports",
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
