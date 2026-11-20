import { ResourceReviewRouteLoading } from "../../../features/resources/resource-review-route-loading-server";
import { pageShellMax5xlTight } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "review-reports-loading-heading",
    titleKey: "reports",
    className: pageShellMax5xlTight,
    rows: 3,
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
