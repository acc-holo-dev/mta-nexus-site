import { PublicReleaseHistoryRouteLoading } from "../../../../features/resources/public-release-history-route-loading-server";
import { pageShellMax5xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return PublicReleaseHistoryRouteLoading({
    headingId: "market-versions-loading-heading",
    className: pageShellMax5xl,
    rowClassName: "h-16 rounded bg-inset",
    rows: 4,
    titleKey: "title",
  });
}
