import { ResourceReviewRouteLoading } from "../../../../features/resources/resource-review-route-loading-server";
import { pageShellMax5xlTight } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceReviewRouteLoading({
    headingId: "library-reviews-loading-heading",
    titleKey: "own",
    loadingKey: "pageLoading",
    className: pageShellMax5xlTight,
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}
