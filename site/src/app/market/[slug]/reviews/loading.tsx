import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";
import { pageShellMax4xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "market-reviews-loading-heading",
    titleKey: "title",
    loadingKey: "pageLoading",
    className: pageShellMax4xl,
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}
