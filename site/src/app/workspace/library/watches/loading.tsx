import { ResourceReleaseWatchesRouteLoading } from "../../../../features/resources/resource-release-watches-route-loading-server";
import { pageShellMax5xlTight } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return ResourceReleaseWatchesRouteLoading({
    headingId: "release-watches-loading-heading",
    className: pageShellMax5xlTight,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
